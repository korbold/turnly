<?php
// apps/backend/app/Application/Services/DiscountReport.php

declare(strict_types=1);

namespace App\Application\Services;

use App\Domain\Pricing\PriceChangeReason;
use App\Infrastructure\Persistence\Models\ReservationItemChangeModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;

/**
 * Cuánto se dejó de cobrar, quién lo decidió y por qué.
 *
 * Une los dos orígenes —registros del día y overrides de reservas— porque al
 * dueño no le importa por qué pantalla entró la plata que no entró.
 */
class DiscountReport
{
    private const CENT = 0.005;

    /**
     * @return array{total_given_away: float, by_reason: array, by_user: array, items: array}
     */
    public function between(string $tenantId, string $from, string $to): array
    {
        $items = array_merge(
            $this->fromServiceLogs($tenantId, $from, $to),
            $this->fromReservations($tenantId, $from, $to),
        );

        usort($items, fn ($a, $b) => $b['date'] <=> $a['date']);

        // Sólo lo regalado. Un recargo no compensa un descuento: el neto
        // escondería los dos.
        $regalado = array_sum(array_map(
            fn ($i) => $i['difference'] < 0 ? -$i['difference'] : 0.0,
            $items,
        ));

        return [
            'total_given_away' => round($regalado, 2),
            'by_reason'        => $this->group($items, 'reason_code'),
            'by_user'          => $this->group($items, 'user_id'),
            'items'            => $items,
        ];
    }

    /** @return array<int, array<string, mixed>> */
    private function fromServiceLogs(string $tenantId, string $from, string $to): array
    {
        $logs = ServiceLogModel::query()
            ->forTenant($tenantId)
            // Un descuento sobre un ticket anulado no se regaló: no existió.
            ->notCancelled()
            ->with(['items', 'attendant', 'clientResource'])
            ->whereBetween('log_date', [$from, $to])
            ->get();

        $out = [];

        foreach ($logs as $log) {
            // La regla —qué cuenta como desvío y por qué una fila sin foto del
            // catálogo no es un descuento— vive en el modelo: la marca de la
            // lista del día tiene que leer exactamente lo mismo que este
            // reporte, o el dueño ve dos cifras distintas del mismo hecho.
            $dev = $log->catalogDeviation();
            if ($dev === null) {
                continue;
            }

            $catalogo = $dev['catalog'];
            $cobrado  = $dev['charged'];
            $dif      = $dev['difference'];

            $out[] = [
                'source'        => 'service_log',
                'id'            => $log->id,
                'date'          => ($log->started_at ?? $log->created_at)?->toIso8601String(),
                'user_id'       => $log->attended_by,
                'user_name'     => $log->attendant?->name,
                // Las claves de `data` son campos personalizados por tenant
                // — uno puede tener "placa" y otro sólo "name" — así que la
                // etiqueta sale del helper que ya la arma en todas partes.
                'client_label'  => $log->clientResource
                    ? \App\Infrastructure\Http\Resources\ClientResourceResource::labelFrom($log->clientResource->data)
                    : null,
                'service_label' => $dev['label'],
                'catalog'       => round($catalogo, 2),
                'charged'       => round($cobrado, 2),
                'difference'    => $dif,
                'reason_code'   => $log->price_change_reason,
                // Mismo default que agrupa group(): un item leído suelto no
                // debe mostrar un hueco donde otro consumidor ve "Sin motivo".
                'reason_label'  => PriceChangeReason::label($log->price_change_reason) ?? 'Sin motivo',
                'note'          => $log->price_change_note,
            ];
        }

        return $out;
    }

    /** @return array<int, array<string, mixed>> */
    private function fromReservations(string $tenantId, string $from, string $to): array
    {
        return ReservationItemChangeModel::query()
            ->forTenant($tenantId)
            ->with('changedBy')
            ->where('action', ReservationItemChangeModel::ACTION_PRICE_OVERRIDE)
            ->whereBetween('changed_at', [$from . ' 00:00:00', $to . ' 23:59:59'])
            ->get()
            ->map(fn ($c) => [
                'source'        => 'reservation',
                'id'            => $c->id,
                'date'          => $c->changed_at?->toIso8601String(),
                'user_id'       => $c->changed_by_user_id,
                'user_name'     => $c->changedBy?->name,
                'client_label'  => null,
                'service_label' => $c->label,
                'catalog'       => (float) $c->old_price,
                'charged'       => (float) $c->new_price,
                'difference'    => round((float) $c->new_price - (float) $c->old_price, 2),
                // Las filas viejas tienen texto libre y ningún código: no
                // "sin motivo" (nadie decidió omitirlo) sino de antes de que
                // el código existiera. Se normaliza a OTRO -no sólo la
                // etiqueta- para que agrupe con su propio motivo y no con los
                // "Sin motivo" de service_logs; no lo "simplifiques" a null.
                'reason_code'   => $c->reason_code ?? PriceChangeReason::OTRO,
                'reason_label'  => PriceChangeReason::label($c->reason_code) ?? 'Otro',
                'note'          => $c->reason,
            ])
            ->filter(fn ($i) => abs($i['difference']) > self::CENT)
            ->values()
            ->all();
    }

    /**
     * Agrupa sumando sólo lo regalado, igual que el titular: un cajero que
     * descuenta $50 y recarga $50 no está en cero.
     */
    private function group(array $items, string $key): array
    {
        $acc = [];

        foreach ($items as $i) {
            if ($i['difference'] >= 0) {
                continue;
            }

            $k = $i[$key] ?? '__none__';
            $acc[$k] ??= [
                'code'  => $i['reason_code'],
                'label' => $i['reason_label'] ?? 'Sin motivo',
                'name'  => $i['user_name'] ?? 'Sin usuario',
                'total' => 0.0,
                'count' => 0,
            ];
            $acc[$k]['total'] = round($acc[$k]['total'] - $i['difference'], 2);
            $acc[$k]['count']++;
        }

        $out = array_values($acc);
        usort($out, fn ($a, $b) => $b['total'] <=> $a['total']);

        return $out;
    }
}
