<?php

namespace App\Infrastructure\Console\Commands;

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use Illuminate\Console\Command;

/**
 * Suelta los vehículos que quedaron colgados de un empleado.
 *
 * Fase 2 del diseño de identidad. El alta ya no los cuelga —el mostrador liga
 * la persona o deja el auto sin dueño— pero lo viejo sigue mal: en producción
 * 237 de 274 vehículos figuran como de la cajera, porque `store()` ponía el id
 * de quien registraba.
 *
 * El efecto no es cosmético. `ClientResourceController::index` esconde a
 * propósito los recursos del personal —para no mostrar los autos de los
 * propios empleados— así que la pantalla de Clientes muestra 37 de 274. El
 * padrón está, pero invisible salvo que se busque la placa exacta.
 *
 * Poner `client_id` en null no pierde información: hoy ese campo dice algo
 * falso. El auto queda sin dueño conocido, que es la verdad, y aparece en
 * Clientes como cualquier walk-in.
 *
 * Efecto lateral aceptado: si un empleado de verdad lava su propio auto ahí,
 * ese vehículo también se suelta y pasa a verse en Clientes sin dueño. Son un
 * puñado contra 237, y se vuelve a ligar desde el buscador de personas.
 */
class ReleaseStaffOwnedVehicles extends Command
{
    protected $signature = 'clients:release-staff-owned
                            {--tenant= : slug del tenant; sin esto, todos}
                            {--dry-run : sólo muestra el plan}';

    protected $description = 'Suelta los vehículos que figuran como de un empleado del local';

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

        $total = 0;

        foreach ($tenants as $tenant) {
            // Personal = todo rol del tenant que no sea `client`. Un cliente
            // dueño de su auto es exactamente lo que hay que dejar en paz.
            $idsPersonal = TenantUserModel::where('tenant_id', $tenant->id)
                ->where('role', '!=', 'client')
                ->pluck('user_id');

            if ($idsPersonal->isEmpty()) {
                continue;
            }

            $query = ClientResourceModel::query()
                ->withoutGlobalScopes()
                ->whereNull('deleted_at')
                ->where('tenant_id', $tenant->id)
                ->whereIn('client_id', $idsPersonal);

            $cuantos = (clone $query)->count();

            if ($cuantos === 0) {
                continue;
            }

            $this->line("<fg=cyan>{$tenant->slug}</> — {$cuantos} vehículo(s) colgados del personal");
            $total += $cuantos;

            if (!$seco) {
                $query->update(['client_id' => null]);
            }
        }

        $this->newLine();
        $this->info(sprintf(
            '%s%d vehículo(s) sueltos',
            $seco ? 'SIMULACRO: ' : '',
            $total,
        ));

        return self::SUCCESS;
    }
}
