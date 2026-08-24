<?php

declare(strict_types=1);

namespace App\Application\Services;

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\PaymentAllocationModel;
use App\Infrastructure\Persistence\Models\PaymentModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use Illuminate\Support\Facades\DB;

/**
 * El único lugar que escribe el libro de pagos.
 *
 * Cinco caminos van a cobrar plata — cobro diferido, cobro al registrar,
 * abono, pago de deuda y el backfill — y todos tienen que producir la misma
 * forma. Un método por camino en cinco controladores distintos es cómo se
 * termina con tres variantes de "pago" que no se pueden sumar entre sí.
 */
class PaymentLedger
{
    /**
     * Los montos redondean a centavos antes de compararse: 0.1 + 0.2 en float
     * no da 0.3, y un servicio pagado en dos partes tiene que cerrar igual.
     */
    private const CENT = 0.005;

    public function __construct(
        private CashRegister $cash,
        private DebtLedger $debts,
    ) {}

    public function recordForServiceLog(
        ServiceLogModel $log,
        float $amount,
        string $method,
        ?string $bank,
        ?string $receivedBy,
        ?\DateTimeInterface $paidAt = null,
        ?string $notes = null,
    ): PaymentModel {
        return DB::transaction(function () use ($log, $amount, $method, $bank, $receivedBy, $paidAt, $notes) {
            // La caja abierta es el contexto del cobro. Se estampa acá y no
            // se infiere después por ventana de tiempo: la caja que se abre
            // tarde y el pago de las 23:58 son los bordes reales, y son
            // justo los días que el dueño revisa.
            $sesion = $this->cash->currentSession($log->tenant_id);

            $payment = PaymentModel::create([
                'tenant_id'       => $log->tenant_id,
                'client_id'       => $log->clientResource?->client_id,
                'amount'          => $amount,
                'method'          => $method,
                'bank'            => $method === 'transfer' ? $bank : null,
                'paid_at'         => $paidAt ?? now(),
                'received_by'     => $receivedBy,
                'cash_session_id' => $sesion?->id,
                'notes'           => $notes,
            ]);

            // Se asigna hasta lo que falta, no todo el pago: cobrar de más
            // deja saldo a favor del cliente, no un servicio sobrepagado.
            $pending   = max(0.0, (float) $log->price_charged - $this->paidFor($log));
            $allocated = min($amount, $pending);

            if ($allocated > 0) {
                PaymentAllocationModel::create([
                    'tenant_id'    => $log->tenant_id,
                    'payment_id'   => $payment->id,
                    'payable_type' => PaymentAllocationModel::PAYABLE_SERVICE_LOG,
                    'payable_id'   => $log->id,
                    'amount'       => $allocated,
                ]);
            }

            $this->syncLogPaymentState($log);

            return $payment->fresh('allocations');
        });
    }

    /**
     * Cuánto se pagó de este servicio, sumando todas sus asignaciones.
     *
     * `forTenant($log->tenant_id)` y no el scope ambiente: el libro también se
     * escribe desde jobs, que corren sin `current_tenant_id` bindeado. Es el
     * patrón que el propio trait recomienda para no depender del contenedor.
     */
    public function paidFor(ServiceLogModel $log): float
    {
        return (float) PaymentAllocationModel::query()
            ->forTenant($log->tenant_id)
            ->where('payable_type', PaymentAllocationModel::PAYABLE_SERVICE_LOG)
            ->where('payable_id', $log->id)
            ->sum('amount');
    }

    public function statusFor(ServiceLogModel $log): string
    {
        $paid  = $this->paidFor($log);
        $total = (float) $log->price_charged;

        if ($paid <= self::CENT) {
            return 'unpaid';
        }

        return $paid + self::CENT >= $total ? 'paid' : 'partial';
    }

    /**
     * Un pago contra la placa, repartido entre sus deudas.
     *
     * Cobrar cuatro deudas de a una es donde el cajero se equivoca, así que
     * esto es un solo pago con varias asignaciones. Sin `$allocations`
     * reparte del más viejo al más nuevo; con ellas respeta lo que el cajero
     * corrigió antes de confirmar.
     *
     * @param array<int, array{type:string,id:string,amount:float}> $allocations
     */
    /**
     * Un pago contra una PERSONA, repartido entre las deudas de todos sus
     * vehículos.
     *
     * Es el mismo mecanismo que contra una placa —un pago con varias
     * asignaciones— subido un nivel. Cobrar auto por auto a alguien que tiene
     * dos es donde el cajero se equivoca y deja mitades abiertas.
     *
     * @param array<int, array{type:string,id:string,amount:float}> $allocations
     */
    public function recordAgainstClient(
        string $tenantId,
        string $clientId,
        float $amount,
        string $method,
        ?string $bank,
        ?string $receivedBy,
        array $allocations = [],
        ?string $notes = null,
    ): PaymentModel {
        $plan = $allocations !== []
            ? $allocations
            : $this->debts->planForClient($tenantId, $clientId, $amount);

        return DB::transaction(function () use (
            $tenantId, $clientId, $amount, $method, $bank, $receivedBy, $plan, $notes
        ) {
            $sesion = $this->cash->currentSession($tenantId);

            $payment = PaymentModel::create([
                'tenant_id'       => $tenantId,
                'client_id'       => $clientId,
                'amount'          => $amount,
                'method'          => $method,
                'bank'            => $method === 'transfer' ? $bank : null,
                'paid_at'         => now(),
                'received_by'     => $receivedBy,
                'cash_session_id' => $sesion?->id,
                'notes'           => $notes,
            ]);

            $this->applyPlan($payment, $tenantId, $plan, $receivedBy);

            return $payment;
        });
    }

    public function recordAgainstResource(
        string $tenantId,
        string $clientResourceId,
        float $amount,
        string $method,
        ?string $bank,
        ?string $receivedBy,
        array $allocations = [],
        ?string $notes = null,
    ): PaymentModel {
        $plan = $allocations !== []
            ? $allocations
            : $this->debts->planFor($tenantId, $clientResourceId, $amount);

        return DB::transaction(function () use (
            $tenantId, $clientResourceId, $amount, $method, $bank, $receivedBy, $plan, $notes
        ) {
            $resource = ClientResourceModel::query()
                ->forTenant($tenantId)
                ->whereKey($clientResourceId)
                ->first();

            $sesion = $this->cash->currentSession($tenantId);

            $payment = PaymentModel::create([
                'tenant_id'       => $tenantId,
                'client_id'       => $resource?->client_id,
                'amount'          => $amount,
                'method'          => $method,
                'bank'            => $method === 'transfer' ? $bank : null,
                'paid_at'         => now(),
                'received_by'     => $receivedBy,
                'cash_session_id' => $sesion?->id,
                'notes'           => $notes,
            ]);

            $this->applyPlan($payment, $tenantId, $plan, $receivedBy);

            return $payment->fresh('allocations');
        });
    }

    /**
     * Recalcula las columnas que viven en la fila del servicio. Siguen ahí
     * porque los filtros de la lista, los tiles y la facturación las leen —
     * pero ya no son la verdad, son un reflejo del libro.
     */
    /**
     * Escribe las asignaciones de un pago y refresca las filas que tocó.
     *
     * Lo comparten el cobro contra una placa y el cobro contra una persona:
     * dos copias serían dos formas de imputar la misma plata.
     *
     * @param array<int, array{type:string,id:string,amount:float}> $plan
     */
    private function applyPlan(PaymentModel $payment, string $tenantId, array $plan, ?string $actorId = null): void
    {
        foreach ($plan as $linea) {
            if ((float) $linea['amount'] <= 0) {
                continue;
            }

            PaymentAllocationModel::create([
                'tenant_id'    => $tenantId,
                'payment_id'   => $payment->id,
                'payable_type' => $linea['type'],
                'payable_id'   => $linea['id'],
                'amount'       => $linea['amount'],
            ]);

            // Las columnas de la fila del servicio son un reflejo del libro:
            // sin esto, la lista del día seguiría diciendo "Pendiente" sobre
            // algo que acaba de cobrarse.
            if ($linea['type'] === PaymentAllocationModel::PAYABLE_SERVICE_LOG) {
                $log = ServiceLogModel::query()->forTenant($tenantId)->find($linea['id']);
                if ($log) {
                    $this->syncLogPaymentState($log);
                }
            }
        }
    }

    public function syncLogPaymentState(ServiceLogModel $log): void
    {
        $status = $this->statusFor($log);

        $last = PaymentModel::query()
            ->forTenant($log->tenant_id)
            ->whereIn('id', PaymentAllocationModel::query()
                ->forTenant($log->tenant_id)
                ->where('payable_type', PaymentAllocationModel::PAYABLE_SERVICE_LOG)
                ->where('payable_id', $log->id)
                ->select('payment_id'))
            ->orderByDesc('paid_at')
            ->orderByDesc('created_at')
            // Desempate determinístico. MySQL guarda los timestamps con
            // precisión de segundo, así que dos cobros seguidos —registrar y
            // cobrar el resto, que es lo normal con un abono— empatan en las
            // dos claves de arriba y el "último pago" quedaba al azar: la fila
            // mostraba el método equivocado. El id es UUIDv7, o sea monótono
            // en el tiempo, así que ordena bien sin agregar columnas.
            ->orderByDesc('id')
            ->first();

        $log->forceFill([
            'payment_status' => $status,
            'payment_method' => $last?->method,
            'payment_bank'   => $last?->bank,
            'paid_at'        => $last?->paid_at,
        ])->save();
    }
}
