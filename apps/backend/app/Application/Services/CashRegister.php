<?php

declare(strict_types=1);

namespace App\Application\Services;

use App\Domain\Cash\CashRegisterException;
use App\Infrastructure\Persistence\Models\CashMovementModel;
use App\Infrastructure\Persistence\Models\CashSessionModel;
use App\Infrastructure\Persistence\Models\PaymentModel;
use Illuminate\Support\Facades\DB;

/**
 * La caja del día, en un solo lugar.
 *
 * La cuenta vive acá y no en el controlador porque el arqueo es la única
 * cifra de todo el sistema que un dueño compara contra billetes de verdad:
 * si dos pantallas la calculan distinto, una de las dos le va a decir que le
 * robaron.
 *
 *     esperado = apertura
 *              + pagos en efectivo de la sesión
 *              + ingresos
 *              − egresos
 *              − retiros
 *
 * Sólo efectivo: tarjeta y transferencia no están en el cajón.
 */
class CashRegister
{
    public function currentSession(string $tenantId): ?CashSessionModel
    {
        return CashSessionModel::query()
            ->forTenant($tenantId)
            ->open()
            ->orderBy('business_date')
            ->first();
    }

    public function sessionFor(string $tenantId, string $businessDate): ?CashSessionModel
    {
        return CashSessionModel::query()
            ->forTenant($tenantId)
            ->whereDate('business_date', $businessDate)
            ->first();
    }

    /**
     * Abrir exige que no quede ninguna caja abierta, ni de hoy ni de antes.
     * La de ayer no se cierra sola: nadie contó esa plata a medianoche, y
     * cerrarla automáticamente con el esperado sería inventar un conteo.
     */
    public function openSession(
        string $tenantId,
        string $businessDate,
        float $openingAmount,
        ?string $userId,
    ): CashSessionModel {
        $abierta = $this->currentSession($tenantId);

        if ($abierta !== null) {
            $suFecha = $abierta->business_date->toDateString();

            throw $suFecha === $businessDate
                ? CashRegisterException::alreadyOpen($suFecha)
                : CashRegisterException::previousSessionOpen($suFecha);
        }

        if ($this->sessionFor($tenantId, $businessDate) !== null) {
            // Ya hubo una caja ese día y se cerró. Cerrada no se reabre.
            throw CashRegisterException::alreadyOpen($businessDate);
        }

        return CashSessionModel::create([
            'tenant_id'      => $tenantId,
            'business_date'  => $businessDate,
            'opened_by'      => $userId,
            'opened_at'      => now(),
            'opening_amount' => $openingAmount,
            'status'         => CashSessionModel::STATUS_OPEN,
        ]);
    }

    public function addMovement(
        CashSessionModel $session,
        string $type,
        float $amount,
        string $reason,
        ?string $userId,
    ): CashMovementModel {
        if (!$session->isOpen()) {
            throw CashRegisterException::sessionClosed();
        }

        if (!in_array($type, CashMovementModel::TYPES, true)) {
            throw CashRegisterException::invalidType($type);
        }

        return CashMovementModel::create([
            'tenant_id'       => $session->tenant_id,
            'cash_session_id' => $session->id,
            'type'            => $type,
            // Siempre positivo: el signo lo pone el tipo. Un egreso de −10
            // sumaría al cajón, que es exactamente el error que este abs()
            // hace imposible.
            'amount'          => abs($amount),
            'reason'          => $reason,
            'created_by'      => $userId,
        ]);
    }

    public function expectedFor(CashSessionModel $session): float
    {
        $efectivo = (float) PaymentModel::query()
            ->forTenant($session->tenant_id)
            ->where('cash_session_id', $session->id)
            ->where('method', 'cash')
            ->sum('amount');

        $porTipo = fn (string $type) => (float) CashMovementModel::query()
            ->forTenant($session->tenant_id)
            ->where('cash_session_id', $session->id)
            ->where('type', $type)
            ->sum('amount');

        return round(
            (float) $session->opening_amount
            + $efectivo
            + $porTipo(CashMovementModel::TYPE_DEPOSIT)
            - $porTipo(CashMovementModel::TYPE_EXPENSE)
            - $porTipo(CashMovementModel::TYPE_WITHDRAWAL),
            2,
        );
    }

    /**
     * El conteo del cajero entra primero; recién entonces se calcula y se
     * congela el esperado. Los tres números quedan escritos en la fila: son
     * un hecho de ese día, y recalcularlos después con pagos que llegaron
     * tarde reescribiría la historia.
     */
    public function closeSession(
        CashSessionModel $session,
        float $countedAmount,
        ?string $userId,
        ?string $notes = null,
    ): CashSessionModel {
        if (!$session->isOpen()) {
            throw CashRegisterException::sessionClosed();
        }

        return DB::transaction(function () use ($session, $countedAmount, $userId, $notes) {
            $esperado = $this->expectedFor($session);

            $session->forceFill([
                'counted_amount'  => $countedAmount,
                'expected_amount' => $esperado,
                'difference'      => round($countedAmount - $esperado, 2),
                'closed_by'       => $userId,
                'closed_at'       => now(),
                'status'          => CashSessionModel::STATUS_CLOSED,
                'notes'           => $notes,
            ])->save();

            return $session->fresh();
        });
    }

    /**
     * Efectivo cobrado ese día que no cayó en ninguna caja. No bloquea nada:
     * es el número que la tarjeta muestra cuando alguien cobró antes de abrir.
     */
    public function cashCollectedWithoutSession(string $tenantId, string $businessDate): float
    {
        return (float) PaymentModel::query()
            ->forTenant($tenantId)
            ->whereNull('cash_session_id')
            ->where('method', 'cash')
            ->whereDate('paid_at', $businessDate)
            ->sum('amount');
    }
}
