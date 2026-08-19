<?php

declare(strict_types=1);

namespace App\Application\Services;

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
            $payment = PaymentModel::create([
                'tenant_id'   => $log->tenant_id,
                'client_id'   => $log->clientResource?->client_id,
                'amount'      => $amount,
                'method'      => $method,
                'bank'        => $method === 'transfer' ? $bank : null,
                'paid_at'     => $paidAt ?? now(),
                'received_by' => $receivedBy,
                'notes'       => $notes,
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
     * Recalcula las columnas que viven en la fila del servicio. Siguen ahí
     * porque los filtros de la lista, los tiles y la facturación las leen —
     * pero ya no son la verdad, son un reflejo del libro.
     */
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
            ->first();

        $log->forceFill([
            'payment_status' => $status,
            'payment_method' => $last?->method,
            'payment_bank'   => $last?->bank,
            'paid_at'        => $last?->paid_at,
        ])->save();
    }
}
