<?php

namespace App\Infrastructure\Console\Commands;

use App\Domain\ClientResource\Plate;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ManualDebtModel;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Fusiona los vehículos que quedaron cargados dos veces con la misma placa.
 *
 * El alta duplicada ya no puede ocurrir —`ClientResourceController::store()`
 * la rechaza— así que esto es una limpieza de una sola vez sobre lo que
 * quedó: en FEDER, 26 placas repartidas en 57 filas, con su historial y su
 * deuda partidos entre las copias.
 *
 * Casi todas las copias son cáscaras vacías: el cajero tecleaba la placa, el
 * formulario creaba la fila, y un minuto después lo intentaba de nuevo. Una
 * placa llegó a tener cuatro filas creadas en ocho minutos, con el servicio
 * en la última.
 *
 * Qué hace, por grupo de placa (normalizada: sin guiones ni espacios, en
 * mayúsculas) dentro de un mismo tenant:
 *
 *   1. Sobrevive la fila más vieja — es el registro original, y su id es el
 *      que más chance tiene de estar anotado en algún lado.
 *   2. Los servicios, reservas y deudas de las otras se re-apuntan a ella.
 *   3. Los campos que la sobreviviente tenga vacíos se completan con lo que
 *      traigan las absorbidas: si una tiene la marca y la otra no, no se
 *      pierde.
 *   4. Las absorbidas se borran. `client_resources` usa soft delete, así que
 *      quedan marcadas y recuperables: si algo salió mal, el dato sigue ahí.
 *
 * No fusiona placas de relleno ("000", "0000"): no son el mismo vehículo.
 * No fusiona grupos con dueños distintos: eso no es un duplicado, es una
 * transferencia y la decide una persona.
 */
class MergeDuplicatePlates extends Command
{
    protected $signature = 'clients:merge-duplicate-plates
                            {--tenant= : slug del tenant; sin esto, todos}
                            {--dry-run : sólo muestra el plan}';

    protected $description = 'Fusiona vehículos duplicados por placa, moviendo su historial a uno solo';

    public function handle(): int
    {
        $seco = (bool) $this->option('dry-run');

        $tenants = TenantModel::query()
            ->when($this->option('tenant'), fn ($q, $slug) => $q->where('slug', $slug))
            ->get(['id', 'slug']);

        if ($tenants->isEmpty()) {
            $this->error('No hay tenants que coincidan.');
            return self::FAILURE;
        }

        $totalGrupos = 0;
        $totalBorradas = 0;
        $totalMovidos = 0;

        foreach ($tenants as $tenant) {
            $grupos = $this->duplicateGroups($tenant->id);

            if ($grupos->isEmpty()) {
                continue;
            }

            $this->newLine();
            $this->line("<fg=cyan>{$tenant->slug}</> — {$grupos->count()} placas duplicadas");

            foreach ($grupos as $placa => $filas) {
                $sobreviviente = $filas->sortBy('created_at')->first();
                $absorbidas    = $filas->reject(fn ($r) => $r->id === $sobreviviente->id);

                $movidos = $this->countAttached($absorbidas->pluck('id')->all());
                $totalGrupos++;
                $totalBorradas += $absorbidas->count();
                $totalMovidos  += $movidos['total'];

                $this->line(sprintf(
                    '  %-10s queda %s (%s) · absorbe %d fila(s) · mueve %d servicio(s), %d reserva(s), %d deuda(s)',
                    $placa,
                    substr($sobreviviente->id, 0, 8),
                    $sobreviviente->created_at?->format('m-d H:i'),
                    $absorbidas->count(),
                    $movidos['service_logs'],
                    $movidos['reservations'],
                    $movidos['debts'],
                ));

                if ($seco) {
                    continue;
                }

                $this->merge($sobreviviente, $absorbidas);
            }
        }

        $this->newLine();
        $this->info(sprintf(
            '%s%d grupo(s) · %d fila(s) absorbidas · %d registro(s) re-apuntados',
            $seco ? 'SIMULACRO: ' : '',
            $totalGrupos,
            $totalBorradas,
            $totalMovidos,
        ));

        return self::SUCCESS;
    }

    /**
     * Las filas del tenant agrupadas por placa normalizada, sólo donde hay más
     * de una y la placa es real. Se agrupa en PHP porque la placa vive dentro
     * de `data`, cuyas claves son campos personalizados por tenant.
     *
     * @return \Illuminate\Support\Collection<string, \Illuminate\Support\Collection<int, ClientResourceModel>>
     */
    private function duplicateGroups(string $tenantId)
    {
        return ClientResourceModel::query()
            ->withoutGlobalScopes()
            ->where('tenant_id', $tenantId)
            ->get()
            ->groupBy(fn ($r) => Plate::normalize(Plate::fromData($r->data)))
            ->reject(fn ($filas, $placa) => $placa === ''
                || Plate::isPlaceholder($placa)
                || $filas->count() < 2
                // Dueños distintos no es un duplicado: es una transferencia, y
                // la decide una persona mirando el caso. Un `client_id` nulo
                // no cuenta como dueño en conflicto: es información que falta
                // —el alta no pudo deducir el nombre y dejó el vehículo sin
                // dueño— y al fusionar se adopta el que sí se conoce.
                || $filas->pluck('client_id')->filter()->unique()->count() > 1);
    }

    /** @param array<int, string> $ids */
    private function countAttached(array $ids): array
    {
        if ($ids === []) {
            return ['service_logs' => 0, 'reservations' => 0, 'debts' => 0, 'total' => 0];
        }

        $logs   = ServiceLogModel::withoutGlobalScopes()->whereIn('client_resource_id', $ids)->count();
        $reser  = ReservationModel::withoutGlobalScopes()->whereIn('client_resource_id', $ids)->count();
        $deudas = ManualDebtModel::withoutGlobalScopes()->whereIn('client_resource_id', $ids)->count();

        return [
            'service_logs' => $logs,
            'reservations' => $reser,
            'debts'        => $deudas,
            'total'        => $logs + $reser + $deudas,
        ];
    }

    private function merge(ClientResourceModel $sobreviviente, $absorbidas): void
    {
        $ids = $absorbidas->pluck('id')->all();

        DB::transaction(function () use ($sobreviviente, $absorbidas, $ids) {
            ServiceLogModel::withoutGlobalScopes()
                ->whereIn('client_resource_id', $ids)
                ->update(['client_resource_id' => $sobreviviente->id]);

            ReservationModel::withoutGlobalScopes()
                ->whereIn('client_resource_id', $ids)
                ->update(['client_resource_id' => $sobreviviente->id]);

            ManualDebtModel::withoutGlobalScopes()
                ->whereIn('client_resource_id', $ids)
                ->update(['client_resource_id' => $sobreviviente->id]);

            // Si la sobreviviente quedó sin dueño y alguna copia sí lo tiene,
            // lo adopta: el vehículo no puede terminar la fusión huérfano.
            if ($sobreviviente->client_id === null) {
                $dueno = $absorbidas->pluck('client_id')->filter()->first();
                if ($dueno) {
                    $sobreviviente->client_id = $dueno;
                }
            }

            // Lo que la sobreviviente no tenga y las otras sí. La marca o el
            // color pueden haber quedado en la copia que se borra.
            $data = $sobreviviente->data ?? [];
            foreach ($absorbidas as $otra) {
                foreach ($otra->data ?? [] as $clave => $valor) {
                    $vacio = !isset($data[$clave]) || trim((string) $data[$clave]) === '';
                    if ($vacio && is_string($valor) && trim($valor) !== '') {
                        $data[$clave] = $valor;
                    }
                }
            }
            $sobreviviente->forceFill([
                'data'      => $data,
                'client_id' => $sobreviviente->client_id,
            ])->save();

            ClientResourceModel::withoutGlobalScopes()->whereIn('id', $ids)->delete();
        });
    }
}
