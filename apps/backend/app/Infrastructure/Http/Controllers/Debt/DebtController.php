<?php

declare(strict_types=1);

namespace App\Infrastructure\Http\Controllers\Debt;

use App\Infrastructure\Http\Support\CurrentTenant;
use App\Application\Services\DebtLedger;
use App\Application\Services\PaymentLedger;
use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ManualDebtModel;
use App\Infrastructure\Persistence\Models\PaymentAllocationModel;
use App\Infrastructure\Persistence\Models\PaymentModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DebtController extends Controller
{
    public function __construct(
        private DebtLedger $debts,
        private PaymentLedger $ledger,
    ) {}

    /**
     * Qué debe una placa y de qué está hecha esa deuda. Devuelve también el
     * historial de pagos: la ficha tiene que poder responder "¿y qué me
     * pagó?" sin una segunda pantalla — y es la misma estructura que va a
     * consumir el estado de cuenta imprimible cuando exista.
     */
    public function show(string $id): JsonResponse
    {
        // findOrFail bajo el TenantScope: la placa de otro tenant es un 404.
        $resource = ClientResourceModel::findOrFail($id);
        $tenantId = CurrentTenant::id();

        $items = $this->debts->outstandingFor($tenantId, $resource->id);

        // El historial cuelga de TODO lo que la placa alguna vez debió, no de
        // lo que sigue abierto: si colgara de lo abierto, un pago se borraría
        // justo cuando termina de saldar una deuda, y ese pago es el único
        // registro de que el cliente pagó.
        $etiquetas = $this->debts->labelsFor($tenantId, $resource->id);
        $idsDeLaPlaca = array_keys($etiquetas);

        $pagos = PaymentModel::query()
            ->forTenant($tenantId)
            ->with(['allocations' => fn ($q) => $q->whereIn('payable_id', $idsDeLaPlaca ?: ['-'])])
            ->whereIn('id', PaymentAllocationModel::query()
                ->forTenant($tenantId)
                ->whereIn('payable_id', $idsDeLaPlaca ?: ['-'])
                ->select('payment_id'))
            ->orderByDesc('paid_at')
            ->orderByDesc('id')
            ->get()
            ->map(fn (PaymentModel $p) => [
                'id'      => $p->id,
                'amount'  => (float) $p->amount,
                'method'  => $p->method,
                'paid_at' => $p->paid_at?->toIso8601String(),
                // A qué se aplicó. "Efectivo $20" no responde la pregunta del
                // cliente; "abonó $15 al cuaderno de julio y $5 al lavado del
                // 2" sí. Las etiquetas salen de `labelsFor`, que incluye lo
                // ya saldado.
                'allocations' => $p->allocations
                    ->sortBy(fn ($a) => $etiquetas[$a->payable_id]['date'] ?? '')
                    ->values()
                    ->map(fn ($a) => [
                        'type'   => $a->payable_type,
                        'id'     => $a->payable_id,
                        'label'  => $etiquetas[$a->payable_id]['label'] ?? 'Deuda',
                        'date'   => $etiquetas[$a->payable_id]['date'] ?? '',
                        'amount' => (float) $a->amount,
                    ]),
            ]);

        return response()->json([
            'data' => [
                'client_resource_id' => $resource->id,
                'total'              => round(array_sum(array_column($items, 'due')), 2),
                'items'              => $items,
                'payments'           => $pagos,
            ],
        ]);
    }

    /**
     * La deuda de una persona: la de todos sus vehículos, sumada y con el
     * detalle de a qué auto pertenece cada renglón.
     *
     * Con `?amount=` devuelve además el reparto que ese monto haría, para que
     * el cajero lo vea ANTES de confirmar. Un automatismo que toca varios
     * autos con un solo pago tiene que poder auditarse de un vistazo.
     */
    public function showClient(Request $request, string $clientId): JsonResponse
    {
        $tenantId = CurrentTenant::id();

        $items = $this->debts->outstandingForClient($tenantId, $clientId);
        $total = round(array_sum(array_column($items, 'due')), 2);

        $monto = $request->filled('amount') ? (float) $request->input('amount') : null;

        return response()->json([
            'data' => [
                'total' => $total,
                'items' => $items,
                'plan'  => $monto !== null
                    ? $this->debts->planForClient($tenantId, $clientId, min($monto, $total))
                    : [],
            ],
        ]);
    }

    /**
     * Cobra o abona contra la persona: un solo pago repartido entre las deudas
     * de sus vehículos, de la más vieja a la más nueva.
     */
    public function storeClientPayment(Request $request, string $clientId): JsonResponse
    {
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01'],
            'method' => ['required', 'in:cash,card,transfer,other'],
            'bank'   => ['nullable', 'string', 'max:40'],
            'notes'  => ['nullable', 'string', 'max:200'],
        ]);

        $tenantId = CurrentTenant::id();
        $total = $this->debts->totalForClient($tenantId, $clientId);

        // Cobrar de más no es un abono: es plata sin deuda a la que imputarse,
        // y quedaría suelta en la caja sin nada que la explique.
        if ((float) $data['amount'] > $total + 0.005) {
            return response()->json([
                'error' => [
                    'code'    => 'AMOUNT_TOO_HIGH',
                    'message' => 'El monto supera lo que esta persona debe.',
                ],
            ], 422);
        }

        $pago = $this->ledger->recordAgainstClient(
            tenantId: $tenantId,
            clientId: $clientId,
            amount: (float) $data['amount'],
            method: $data['method'],
            bank: $data['bank'] ?? null,
            receivedBy: $request->user()?->id,
            notes: $data['notes'] ?? null,
        );

        return response()->json([
            'data' => [
                'payment_id' => $pago->id,
                'total'      => $this->debts->totalForClient($tenantId, $clientId),
            ],
        ]);
    }

    public function storeManual(Request $request): JsonResponse
    {
        $data = $request->validate([
            'client_resource_id' => ['required', 'uuid'],
            'amount'             => ['required', 'numeric', 'min:0.01'],
            // Una deuda sin motivo ni fecha no se puede defender frente al
            // cliente el día que la discute.
            'reason'             => ['required', 'string', 'max:200'],
            'incurred_on'        => ['required', 'date'],
        ]);

        $resource = ClientResourceModel::findOrFail($data['client_resource_id']);

        $debt = ManualDebtModel::create([
            'tenant_id'          => CurrentTenant::id(),
            'client_resource_id' => $resource->id,
            'client_id'          => $resource->client_id,
            'amount'             => $data['amount'],
            'reason'             => $data['reason'],
            'incurred_on'        => $data['incurred_on'],
            'created_by'         => $request->user()?->id,
        ]);

        return response()->json([
            'data' => [
                'id'          => $debt->id,
                'amount'      => (float) $debt->amount,
                'reason'      => $debt->reason,
                'incurred_on' => $debt->incurred_on?->toDateString(),
            ],
        ], 201);
    }

    public function storePayment(Request $request): JsonResponse
    {
        $data = $request->validate([
            'client_resource_id'    => ['required', 'uuid'],
            'amount'                => ['required', 'numeric', 'min:0.01'],
            'method'                => ['required', 'in:cash,card,transfer,other'],
            'bank'                  => ['nullable', 'string', 'max:40'],
            // Reparto corregido a mano. Ausente, se reparte del más viejo al
            // más nuevo.
            'allocations'           => ['sometimes', 'array'],
            'allocations.*.type'    => ['required', 'in:service_log,manual_debt'],
            'allocations.*.id'      => ['required', 'uuid'],
            'allocations.*.amount'  => ['required', 'numeric', 'min:0.01'],
        ]);

        $resource = ClientResourceModel::findOrFail($data['client_resource_id']);

        $payment = $this->ledger->recordAgainstResource(
            CurrentTenant::id(),
            $resource->id,
            (float) $data['amount'],
            $data['method'],
            $data['bank'] ?? null,
            $request->user()?->id,
            $data['allocations'] ?? [],
        );

        return response()->json([
            'data' => [
                'id'          => $payment->id,
                'amount'      => (float) $payment->amount,
                'method'      => $payment->method,
                'allocations' => $payment->allocations->map(fn ($a) => [
                    'type'   => $a->payable_type,
                    'id'     => $a->payable_id,
                    'amount' => (float) $a->amount,
                ]),
            ],
        ], 201);
    }
}
