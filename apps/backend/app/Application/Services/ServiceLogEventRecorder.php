<?php

declare(strict_types=1);

namespace App\Application\Services;

use App\Infrastructure\Persistence\Models\ServiceLogEventModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceStaffModel;

/**
 * Escritor único de la bitácora del servicio.
 *
 * Un método por evento en vez de un record(string $event, array $detail)
 * genérico: el tipo de cada firma es lo que impide que dos de los siete
 * llamadores escriban el mismo evento con formas distintas de `detail`, que
 * es la falla que vuelve inservible una bitácora seis meses después, justo
 * cuando hace falta.
 */
class ServiceLogEventRecorder
{
    public function created(ServiceLogModel $log, ?string $actorId): void
    {
        $this->write($log, ServiceLogEventModel::EVENT_CREATED, [], $actorId);
    }

    /**
     * Los nombres van desnormalizados: si el catálogo se renombra, la
     * bitácora tiene que seguir diciendo lo que decía el día del servicio.
     */
    public function assigneeChanged(
        ServiceLogModel $log,
        string $position,
        ?ServiceStaffModel $from,
        ?ServiceStaffModel $to,
        ?string $actorId,
    ): void {
        $this->write($log, ServiceLogEventModel::EVENT_ASSIGNEE_CHANGED, [
            'position'  => $position,
            'from_id'   => $from?->id,
            'from_name' => $from?->name,
            'to_id'     => $to?->id,
            'to_name'   => $to?->name,
        ], $actorId);
    }

    public function itemsChanged(
        ServiceLogModel $log,
        float $totalBefore,
        float $totalAfter,
        ?string $actorId,
    ): void {
        $this->write($log, ServiceLogEventModel::EVENT_ITEMS_CHANGED, [
            'total_before' => $totalBefore,
            'total_after'  => $totalAfter,
        ], $actorId);
    }

    /**
     * Edición del registro por el editor: método de pago, banco, empleado,
     * notas. Un solo evento con la lista de lo que cambió — el editor guarda
     * todo junto y separarlo en cuatro líneas leería peor que una.
     *
     * @param  array<int,array{field:string,from:mixed,to:mixed}>  $changes
     */
    public function logUpdated(ServiceLogModel $log, array $changes, ?string $actorId): void
    {
        if ($changes === []) {
            return;
        }

        $this->write($log, ServiceLogEventModel::EVENT_LOG_UPDATED, [
            'changes' => array_values($changes),
        ], $actorId);
    }

    public function paymentRecorded(
        ServiceLogModel $log,
        string $method,
        ?string $bank,
        float $amount,
        ?string $actorId,
        float $remaining = 0.0,
    ): void {
        $this->write($log, ServiceLogEventModel::EVENT_PAYMENT_RECORDED, [
            'method'    => $method,
            'bank'      => $bank,
            'amount'    => $amount,
            // Lo que faltaba después de este cobro. Sin esto la bitácora
            // muestra tres pagos sueltos y nadie puede reconstruir si el
            // servicio quedó saldado o no.
            'remaining' => $remaining,
        ], $actorId);
    }

    /**
     * El cliente se fue con el saldo pendiente. Sin este evento, la fila y la
     * lista de deudores dicen que debe pero nadie puede reconstruir quién lo
     * dejó salir ni cuándo.
     */
    public function leftOwing(ServiceLogModel $log, float $amount, ?string $actorId): void
    {
        $this->write($log, ServiceLogEventModel::EVENT_LEFT_OWING, [
            'amount' => $amount,
        ], $actorId);
    }

    public function statusChanged(
        ServiceLogModel $log,
        string $from,
        string $to,
        ?string $actorId,
    ): void {
        $this->write($log, ServiceLogEventModel::EVENT_STATUS_CHANGED, [
            'from' => $from,
            'to'   => $to,
        ], $actorId);
    }

    public function invoiceRequested(ServiceLogModel $log, ?string $actorId): void
    {
        $this->write($log, ServiceLogEventModel::EVENT_INVOICE_REQUESTED, [], $actorId);
    }

    /**
     * Sin actor: el veredicto lo emite el SRI y llega por un job, no por una
     * persona. La UI lo muestra como "SRI".
     */
    public function invoiceStatusChanged(
        ServiceLogModel $log,
        ?string $from,
        string $to,
        ?string $reason = null,
    ): void {
        $this->write($log, ServiceLogEventModel::EVENT_INVOICE_STATUS_CHANGED, [
            'from'   => $from,
            'to'     => $to,
            'reason' => $reason,
        ], null);
    }

    /**
     * El precio no fue el del catálogo. Sin este evento un descuento se ve
     * igual que una venta normal, que es exactamente el problema.
     */
    public function priceChanged(
        ServiceLogModel $log,
        float $catalog,
        float $charged,
        ?string $reason,
        ?string $note,
        ?string $actorId,
    ): void {
        $this->write($log, ServiceLogEventModel::EVENT_PRICE_CHANGED, [
            'catalog'    => $catalog,
            'charged'    => $charged,
            'difference' => round($charged - $catalog, 2),
            'reason'     => $reason,
            'note'       => $note,
        ], $actorId);
    }

    /**
     * tenant_id sale del log y no del contenedor: los jobs corren sin
     * current_tenant_id bindeado, y TenantScope no rellena en el insert.
     */
    private function write(ServiceLogModel $log, string $event, array $detail, ?string $actorId): void
    {
        ServiceLogEventModel::create([
            'tenant_id'          => $log->tenant_id,
            'service_log_id'     => $log->id,
            'event'              => $event,
            'detail'             => $detail,
            'changed_by_user_id' => $actorId,
            'changed_at'         => now(),
        ]);
    }
}
