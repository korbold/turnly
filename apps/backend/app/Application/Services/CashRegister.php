<?php

declare(strict_types=1);

namespace App\Application\Services;

use App\Domain\Cash\CashRegisterException;
use App\Infrastructure\Persistence\Models\CashMovementModel;
use App\Infrastructure\Persistence\Models\CashSessionClosureModel;
use App\Infrastructure\Persistence\Models\CashSessionModel;
use App\Infrastructure\Persistence\Models\PaymentAllocationModel;
use App\Infrastructure\Persistence\Models\PaymentModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
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
        ?array $countedBreakdown = null,
    ): CashSessionModel {
        if (!$session->isOpen()) {
            throw CashRegisterException::sessionClosed();
        }

        return DB::transaction(function () use ($session, $countedAmount, $userId, $notes, $countedBreakdown) {
            $esperado = $this->expectedFor($session);

            $cerradoEn = now();

            $session->forceFill([
                'counted_amount'  => $countedAmount,
                // El detalle y no sólo la suma: "conté $54.20" no dice si
                // faltó un billete de $20 o veinte monedas de a peso.
                'counted_breakdown' => $countedBreakdown,
                'expected_amount' => $esperado,
                'difference'      => round($countedAmount - $esperado, 2),
                'closed_by'       => $userId,
                'closed_at'       => $cerradoEn,
                'status'          => CashSessionModel::STATUS_CLOSED,
                'notes'           => $notes,
            ])->save();

            // El arqueo también queda en su propia fila. Si mañana alguien
            // reabre esta caja, la sesión va a mostrar el conteo nuevo y este
            // seguirá acá: los dos ocurrieron.
            CashSessionClosureModel::create([
                'tenant_id'       => $session->tenant_id,
                'cash_session_id' => $session->id,
                'counted_amount'    => $countedAmount,
                'counted_breakdown' => $countedBreakdown,
                'expected_amount'   => $esperado,
                'difference'        => round($countedAmount - $esperado, 2),
                'closed_by'         => $userId,
                'closed_at'         => $cerradoEn,
                'notes'             => $notes,
            ]);

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

    /**
     * Lo que el día registró y todavía nadie cobró: cuántos servicios y
     * cuánto.
     *
     * El 24 de agosto la caja de FEDER cerró a las 18:35 con 8 servicios sin
     * cobrar por $305, y veintiún minutos después alguien cobró $45 de uno de
     * ellos con el cajón ya cerrado — ese pago no cayó en ninguna caja. El
     * cajero no tenía cómo saber que estaba cerrando temprano: con la caja
     * abierta los totales del día se le ocultan para el conteo ciego.
     *
     * Este número se puede mostrar sin romper ese conteo, porque es plata que
     * NO está en el cajón: no revela el esperado ni participa de él.
     */
    public function pendingCollection(string $tenantId, string $businessDate): array
    {
        $logs = ServiceLogModel::query()
            ->forTenant($tenantId)
            ->whereDate('log_date', $businessDate)
            ->where('status', '!=', 'cancelled')
            ->get(['id', 'price_charged']);

        if ($logs->isEmpty()) {
            return ['count' => 0, 'amount' => 0.0];
        }

        // Lo cobrado por servicio sale de las asignaciones y no de
        // `payment_status`: un cobro parcial deja el estado en 'partial' sin
        // decir cuánto falta, y lo que falta es justamente el número.
        $pagado = PaymentAllocationModel::query()
            ->forTenant($tenantId)
            ->whereIn('payable_id', $logs->pluck('id'))
            ->selectRaw('payable_id, SUM(amount) as total')
            ->groupBy('payable_id')
            ->pluck('total', 'payable_id');

        $cuenta = 0;
        $monto  = 0.0;

        foreach ($logs as $log) {
            $falta = (float) $log->price_charged - (float) ($pagado[$log->id] ?? 0);

            // El medio centavo evita contar como pendiente un servicio saldado
            // que quedó con un resto de redondeo.
            if ($falta > 0.005) {
                $cuenta++;
                $monto += $falta;
            }
        }

        return ['count' => $cuenta, 'amount' => round($monto, 2)];
    }

    /**
     * Cuánto efectivo cobró cada persona en esta caja.
     *
     * En FEDER el cajón es de dos: Vanessa lo abre y lo cierra, Fernanda cobra
     * el 85%. Sin este desglose, una diferencia se le adjudica entera a quien
     * firmó el arqueo, y el dueño no tiene con qué separar una cosa de la otra.
     *
     * Se calcula al cerrar y no antes: sumar estas filas da el esperado, que
     * es exactamente lo que el conteo ciego oculta.
     */
    public function cashByPerson(CashSessionModel $session): array
    {
        return PaymentModel::query()
            ->forTenant($session->tenant_id)
            ->where('cash_session_id', $session->id)
            ->where('method', 'cash')
            ->with('receiver:id,name')
            ->get()
            ->groupBy('received_by')
            ->map(fn ($pagos) => [
                'user_id' => $pagos->first()->received_by,
                'name'    => $pagos->first()->receiver?->name ?? 'Sin identificar',
                'count'   => $pagos->count(),
                'amount'  => round((float) $pagos->sum('amount'), 2),
            ])
            ->sortByDesc('amount')
            ->values()
            ->all();
    }

    /**
     * Reabrir una caja que se cerró antes de que terminara el día.
     *
     * El 24 de agosto FEDER cerró a las 18:35 con 8 servicios sin cobrar por
     * $305; a las 18:56 cobraron $45 de uno y ese pago no cayó en ninguna
     * caja. Sin reapertura, la única salida es que el dinero quede fuera del
     * arqueo para siempre.
     *
     * Quién puede hacerlo se decide en el controlador (dueño o admin, nunca
     * el cajero sobre su propio conteo). Acá vive lo que significa reabrir:
     *
     * 1. El arqueo firmado se conserva — ya está escrito en `closures`, sólo
     *    se le anota quién lo reabrió y por qué.
     * 2. Los campos del cierre vuelven a NULL: una caja abierta que mostrara
     *    un esperado no sería un conteo ciego.
     * 3. El efectivo cobrado mientras estuvo cerrada vuelve a esta caja. Ese
     *    billete está en el cajón, y el arqueo que sigue es el primero que
     *    puede contarlo.
     */
    public function reopenSession(
        CashSessionModel $session,
        string $reason,
        ?string $userId,
    ): CashSessionModel {
        if ($session->isOpen()) {
            throw CashRegisterException::sessionAlreadyOpen();
        }

        return DB::transaction(function () use ($session, $reason, $userId) {
            CashSessionClosureModel::query()
                ->where('cash_session_id', $session->id)
                ->whereNull('reopened_at')
                ->update([
                    'reopened_by'   => $userId,
                    'reopened_at'   => now(),
                    'reopen_reason' => $reason,
                ]);

            $cerradaEn = $session->closed_at;

            $session->forceFill([
                'status'          => CashSessionModel::STATUS_OPEN,
                'counted_amount'  => null,
                'expected_amount' => null,
                'difference'      => null,
                'closed_by'       => null,
                'closed_at'       => null,
            ])->save();

            // Lo cobrado entre aquel cierre y ahora. El corte en `closed_at`
            // es lo que impide que la caja se trague cobros de otros días que
            // nunca tuvieron sesión.
            if ($cerradaEn !== null) {
                PaymentModel::query()
                    ->forTenant($session->tenant_id)
                    ->whereNull('cash_session_id')
                    ->where('paid_at', '>=', $cerradaEn)
                    ->update(['cash_session_id' => $session->id]);
            }

            return $session->fresh();
        });
    }

    /**
     * ¿Este tenant exige caja abierta para cobrar en efectivo?
     *
     * Detrás de un ajuste y no encendido para todos porque hay negocios que
     * nunca abren caja: para ellos la regla sería un candado sobre cada cobro
     * en efectivo que hacen. Apagado es el default, así que un tenant que no
     * sabe que esto existe sigue trabajando igual.
     */
    public function requiresOpenTillForCash(string $tenantId): bool
    {
        $tenant = TenantModel::find($tenantId);

        return (bool) ($tenant?->settings['require_open_till_for_cash'] ?? false);
    }

    /**
     * Lo que hay que cumplir para que un billete entre al sistema.
     *
     * El 24 de agosto se cobraron $45 en efectivo veintiún minutos después
     * del cierre: ese billete quedó en el cajón sin que ningún arqueo lo
     * esperara. Sólo el efectivo — tarjeta y transferencia no tocan el cajón,
     * y pedirles caja abierta sería un candado sin motivo.
     */
    public function guardCashPayment(string $tenantId, string $method): void
    {
        if ($method !== 'cash' || !$this->requiresOpenTillForCash($tenantId)) {
            return;
        }

        if ($this->currentSession($tenantId) === null) {
            throw CashRegisterException::cashNeedsOpenTill();
        }
    }
}
