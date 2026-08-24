<?php

declare(strict_types=1);

namespace App\Application\Services;

use App\Infrastructure\Http\Resources\ClientResourceResource;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ManualDebtModel;
use App\Infrastructure\Persistence\Models\PaymentAllocationModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use Illuminate\Support\Facades\DB;

/**
 * Qué debe un cliente, y en qué orden se le cobra.
 *
 * Vive acá y no en el controlador porque cuatro features que todavía no
 * existen —límite de crédito, intereses, recordatorios y estado de cuenta—
 * hacen exactamente esta pregunta. Incrustarla en un controlador es lo único
 * que las bloquearía.
 *
 * Nada de esto se almacena: la deuda es la suma de lo impago de los servicios
 * marcados `left_owing` más las deudas cargadas a mano. Un saldo guardado se
 * desincroniza y después nadie sabe cuál de los dos miente.
 */
class DebtLedger
{
    /** El mismo centavo que usa PaymentLedger para decidir si algo está saldado. */
    private const CENT = 0.005;

    /**
     * Las deudas de una placa, de la más vieja a la más nueva. Ese orden ES
     * el reparto por defecto, así que la consulta lo produce ya ordenado.
     *
     * @return array<int, array{type:string,id:string,label:string,date:string,amount:float,paid:float,due:float}>
     */
    public function outstandingFor(string $tenantId, string $clientResourceId): array
    {
        return $this->outstandingForResources($tenantId, [$clientResourceId]);
    }

    /**
     * Las deudas de una persona: las de todos sus vehículos, mezcladas y de la
     * más vieja a la más nueva.
     *
     * Cobrar auto por auto es donde el cajero se equivoca con alguien que tiene
     * dos, y deja mitades abiertas que nadie ve. Cada deuda viaja con la
     * etiqueta de SU vehículo, porque el cajero tiene al cliente enfrente y
     * necesita saber qué le está cobrando.
     *
     * @return array<int, array<string, mixed>>
     */
    public function outstandingForClient(string $tenantId, string $clientId): array
    {
        $vehiculos = ClientResourceModel::query()
            ->forTenant($tenantId)
            ->where('client_id', $clientId)
            ->get(['id', 'data']);

        if ($vehiculos->isEmpty()) {
            return [];
        }

        $etiquetas = $vehiculos->mapWithKeys(fn ($r) => [
            $r->id => ClientResourceResource::labelFrom($r->data),
        ]);

        $items = $this->outstandingForResources($tenantId, $vehiculos->pluck('id')->all());

        return array_map(fn ($i) => $i + [
            'resource_label' => $etiquetas[$i['resource_id']] ?? null,
        ], $items);
    }

    public function totalForClient(string $tenantId, string $clientId): float
    {
        return round(
            array_sum(array_column($this->outstandingForClient($tenantId, $clientId), 'due')),
            2,
        );
    }

    /**
     * El reparto de un monto entre las deudas de una persona, de la más vieja
     * a la más nueva. Es el mismo criterio que dentro de un vehículo.
     */
    public function planForClient(string $tenantId, string $clientId, float $amount): array
    {
        return $this->planFrom($this->outstandingForClient($tenantId, $clientId), $amount);
    }

    /**
     * @param  array<int, string>  $clientResourceIds
     * @return array<int, array<string, mixed>>
     */
    private function outstandingForResources(string $tenantId, array $clientResourceIds): array
    {
        $pagado = $this->paidByPayable($tenantId);

        $items = [];

        $logs = ServiceLogModel::query()
            ->forTenant($tenantId)
            ->with(['service', 'items'])
            ->whereIn('client_resource_id', $clientResourceIds)
            ->where('left_owing', true)
            ->where('payment_status', '!=', 'paid')
            ->get();

        foreach ($logs as $log) {
            $abonado = (float) ($pagado[$log->id] ?? 0.0);
            $due = round((float) $log->price_charged - $abonado, 2);
            if ($due <= self::CENT) {
                continue;
            }

            $items[] = [
                'type'   => PaymentAllocationModel::PAYABLE_SERVICE_LOG,
                'id'     => $log->id,
                'resource_id' => $log->client_resource_id,
                'label'  => $this->labelFor($log),
                'date'   => ($log->log_date ?? $log->created_at)?->toDateString() ?? '',
                'amount' => (float) $log->price_charged,
                'paid'   => $abonado,
                'due'    => $due,
            ];
        }

        $manuales = ManualDebtModel::query()
            ->forTenant($tenantId)
            ->whereIn('client_resource_id', $clientResourceIds)
            ->get();

        foreach ($manuales as $d) {
            $abonado = (float) ($pagado[$d->id] ?? 0.0);
            $due = round((float) $d->amount - $abonado, 2);
            if ($due <= self::CENT) {
                continue;
            }

            $items[] = [
                'type'   => PaymentAllocationModel::PAYABLE_MANUAL_DEBT,
                'id'     => $d->id,
                'resource_id' => $d->client_resource_id,
                'label'  => $d->reason,
                'date'   => $d->incurred_on?->toDateString() ?? '',
                'amount' => (float) $d->amount,
                'paid'   => $abonado,
                'due'    => $due,
            ];
        }

        // De la más vieja a la más nueva, mezclando ambas fuentes: la deuda
        // del cuaderno de julio se cobra antes que el lavado de agosto.
        usort($items, fn ($a, $b) => $a['date'] <=> $b['date']);

        return $items;
    }

    public function totalFor(string $tenantId, string $clientResourceId): float
    {
        return round(
            array_sum(array_column($this->outstandingFor($tenantId, $clientResourceId), 'due')),
            2,
        );
    }

    /**
     * Saldo de cada placa del tenant. DOS consultas agregadas: con doscientos
     * vehículos, una por fila convierte la lista de Clientes en un timeout.
     *
     * @return array<string, float>  client_resource_id => saldo
     */
    public function debtByResource(string $tenantId): array
    {
        $porServicio = DB::table('service_logs as sl')
            ->leftJoin(DB::raw('(
                SELECT payable_id, SUM(amount) AS paid
                FROM payment_allocations
                WHERE payable_type = \'service_log\'
                GROUP BY payable_id
            ) pa'), 'pa.payable_id', '=', 'sl.id')
            ->where('sl.tenant_id', $tenantId)
            ->where('sl.left_owing', true)
            ->where('sl.payment_status', '!=', 'paid')
            ->whereNotNull('sl.client_resource_id')
            ->groupBy('sl.client_resource_id')
            ->selectRaw('sl.client_resource_id, SUM(sl.price_charged - COALESCE(pa.paid, 0)) AS due')
            ->pluck('due', 'client_resource_id');

        $porManual = DB::table('manual_debts as md')
            ->leftJoin(DB::raw('(
                SELECT payable_id, SUM(amount) AS paid
                FROM payment_allocations
                WHERE payable_type = \'manual_debt\'
                GROUP BY payable_id
            ) pa'), 'pa.payable_id', '=', 'md.id')
            ->where('md.tenant_id', $tenantId)
            ->whereNotNull('md.client_resource_id')
            ->groupBy('md.client_resource_id')
            ->selectRaw('md.client_resource_id, SUM(md.amount - COALESCE(pa.paid, 0)) AS due')
            ->pluck('due', 'client_resource_id');

        $mapa = [];
        foreach ([$porServicio, $porManual] as $fuente) {
            foreach ($fuente as $resourceId => $due) {
                $mapa[$resourceId] = round(($mapa[$resourceId] ?? 0.0) + (float) $due, 2);
            }
        }

        // Un saldo de cero no es un deudor.
        return array_filter($mapa, fn ($due) => $due > self::CENT);
    }

    /**
     * Cómo se reparte un cobro: del más viejo al más nuevo, hasta agotarlo.
     * Lo que sobre no se planifica — es saldo a favor, no una deuda pagada
     * de más.
     *
     * @return array<int, array{type:string,id:string,amount:float}>
     */
    public function planFor(string $tenantId, string $clientResourceId, float $amount): array
    {
        return $this->planFrom($this->outstandingFor($tenantId, $clientResourceId), $amount);
    }

    /**
     * Reparte un monto entre deudas ya ordenadas. Una sola implementación para
     * la placa y para la persona: dos repartos distintos serían dos formas de
     * imputar la misma plata.
     *
     * @param  array<int, array<string, mixed>>  $items
     */
    private function planFrom(array $items, float $amount): array
    {
        $restante = round($amount, 2);
        $plan = [];

        foreach ($items as $item) {
            if ($restante <= self::CENT) {
                break;
            }

            $aplica = min($restante, $item['due']);
            $plan[] = [
                'type'   => $item['type'],
                'id'     => $item['id'],
                'amount' => round($aplica, 2),
                'label'  => $item['label'] ?? null,
                'resource_label' => $item['resource_label'] ?? null,
            ];
            $restante = round($restante - $aplica, 2);
        }

        return $plan;
    }

    /**
     * Todo lo que esta placa alguna vez debió, saldado o no.
     *
     * Distinto de `outstandingFor`, que sólo devuelve lo abierto: el historial
     * de pagos cuelga de acá porque si colgara de lo abierto, un pago
     * desaparecería justo cuando termina de saldar una deuda — y ese pago es
     * el único registro de que el cliente pagó.
     *
     * @return array<int, string>
     */
    public function payableIdsFor(string $tenantId, string $clientResourceId): array
    {
        $logs = ServiceLogModel::query()
            ->forTenant($tenantId)
            ->where('client_resource_id', $clientResourceId)
            ->where('left_owing', true)
            ->pluck('id')
            ->all();

        $manuales = ManualDebtModel::query()
            ->forTenant($tenantId)
            ->where('client_resource_id', $clientResourceId)
            ->pluck('id')
            ->all();

        return array_merge($logs, $manuales);
    }

    /**
     * Cómo se llama cada cosa que esta placa alguna vez debió, saldada o no.
     *
     * Las etiquetas NO pueden salir de `outstandingFor`: cuando una deuda se
     * salda desaparece de ahí, y el historial quedaría diciendo "abonó $15 a
     * (nada)" justo sobre el pago que la canceló.
     *
     * @return array<string, array{type:string,label:string,date:string}>
     */
    public function labelsFor(string $tenantId, string $clientResourceId): array
    {
        $mapa = [];

        $logs = ServiceLogModel::query()
            ->forTenant($tenantId)
            ->with(['service', 'items'])
            ->where('client_resource_id', $clientResourceId)
            ->where('left_owing', true)
            ->get();

        foreach ($logs as $log) {
            $mapa[$log->id] = [
                'type'  => PaymentAllocationModel::PAYABLE_SERVICE_LOG,
                'label' => $this->labelFor($log),
                'date'  => ($log->log_date ?? $log->created_at)?->toDateString() ?? '',
            ];
        }

        $manuales = ManualDebtModel::query()
            ->forTenant($tenantId)
            ->where('client_resource_id', $clientResourceId)
            ->get();

        foreach ($manuales as $d) {
            $mapa[$d->id] = [
                'type'  => PaymentAllocationModel::PAYABLE_MANUAL_DEBT,
                'label' => $d->reason,
                'date'  => $d->incurred_on?->toDateString() ?? '',
            ];
        }

        return $mapa;
    }

    /**
     * Lo abonado a cada cosa, en una consulta. Se hace acá y no por fila
     * porque `outstandingFor` puede tener veinte líneas y el detalle de un
     * deudor no debería costar veinte consultas.
     *
     * @return array<string, float>  payable_id => monto abonado
     */
    private function paidByPayable(string $tenantId): array
    {
        return PaymentAllocationModel::query()
            ->forTenant($tenantId)
            ->groupBy('payable_id')
            ->selectRaw('payable_id, SUM(amount) AS paid')
            ->pluck('paid', 'payable_id')
            ->map(fn ($v) => (float) $v)
            ->all();
    }

    private function labelFor(ServiceLogModel $log): string
    {
        $items = $log->items;
        if ($items && $items->isNotEmpty()) {
            $extra = $items->count() > 1 ? ' +' . ($items->count() - 1) . ' más' : '';
            return $items->first()->label . $extra;
        }

        return $log->service?->name ?? 'Servicio';
    }
}
