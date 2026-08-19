<?php

declare(strict_types=1);

namespace App\Infrastructure\Http\Controllers\Debt;

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
        $tenantId = app('current_tenant_id');

        $items = $this->debts->outstandingFor($tenantId, $resource->id);

        $pagos = PaymentModel::query()
            ->forTenant($tenantId)
            ->whereIn('id', PaymentAllocationModel::query()
                ->forTenant($tenantId)
                ->whereIn('payable_id', array_column($items, 'id') ?: ['-'])
                ->select('payment_id'))
            ->orderByDesc('paid_at')
            ->get()
            ->map(fn (PaymentModel $p) => [
                'id'      => $p->id,
                'amount'  => (float) $p->amount,
                'method'  => $p->method,
                'paid_at' => $p->paid_at?->toIso8601String(),
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
            'tenant_id'          => app('current_tenant_id'),
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
            app('current_tenant_id'),
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
