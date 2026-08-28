<?php

declare(strict_types=1);

namespace App\Infrastructure\Console\Commands;

use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Limpia los registros que nunca llegaron a ser una cuenta: alguien puso su
 * correo, no lo verificó, y a las 24h no queda nada que guardar.
 *
 * Lo que NO limpia, desde el 28 de agosto de 2026: a quien ya tiene historia.
 *
 * El mostrador crea un usuario por cada walk-in que da su nombre —correo
 * inventado `nombre-XXXX@client.local`, sin verificar nunca, porque no hay
 * a dónde mandarle el mail— y este comando, corriendo cada hora, se los
 * llevaba a las 24h. `client_resources.client_id` es ON DELETE CASCADE, así
 * que el vehículo se iba con la persona, y `service_logs.client_resource_id`
 * es ON DELETE SET NULL: el servicio quedaba "Sin recurso", con su precio y
 * su cobro intactos y sin saber sobre qué auto se trabajó. La base lo hacía
 * sin tocar `updated_at` ni escribir en la bitácora, así que durante semanas
 * pareció que el registro perdía el vehículo al completarse. En FEDER
 * quedaron 32 servicios así, irrecuperables: la fila del vehículo está
 * borrada en duro, sin soft delete.
 *
 * De ahí las dos puertas de `shouldKeep()`. La del correo es la regla del
 * mostrador; la de la historia es la general, y vale para cualquiera: un
 * usuario que ya tiene datos colgando no es un registro abandonado, sea cual
 * sea su correo.
 */
class PurgeUnverifiedUsersCommand extends Command
{
    protected $signature = 'users:purge-unverified {--hours=24}';

    protected $description = 'Delete users that never verified their email after N hours';

    /**
     * Dominio del correo de relleno que `findOrCreateClient()` le inventa al
     * cliente del mostrador. No es una dirección: es un hueco con forma de
     * correo, y jamás va a verificarse.
     */
    private const WALK_IN_DOMAIN = '@client.local';

    /**
     * Dónde mirar si un usuario ya tiene historia. Tabla ⇒ columnas que lo
     * apuntan. Están las de CASCADE (borrarlo se lleva la fila) y también las
     * de SET NULL: perder de quién era un cobro es perder el dato igual.
     *
     * @var array<string, array<int, string>>
     */
    private const HISTORY = [
        'client_resources'      => ['client_id'],
        'reservations'          => ['client_id', 'created_by', 'assigned_to'],
        'service_logs'          => ['attended_by', 'created_by'],
        'payments'              => ['client_id', 'received_by'],
        'manual_debts'          => ['client_id', 'created_by'],
        'user_billing_profiles' => ['user_id'],
    ];

    public function handle(): int
    {
        $hours = (int) $this->option('hours');
        $cutoff = now()->subHours($hours);

        $users = UserModel::whereNull('email_verified_at')
            ->where('created_at', '<', $cutoff)
            ->get()
            ->reject(fn (UserModel $user) => $this->shouldKeep($user));

        if ($users->isEmpty()) {
            $this->info('No unverified users to purge.');
            return self::SUCCESS;
        }

        $count = 0;
        DB::transaction(function () use ($users, &$count) {
            foreach ($users as $user) {
                // Cascade delete via tenant_users + email_verification_codes (FK).
                // Tenants created during register are dropped if no other user remains.
                $tenantIds = DB::table('tenant_users')
                    ->where('user_id', $user->id)
                    ->pluck('tenant_id');

                $user->delete();

                foreach ($tenantIds as $tenantId) {
                    $remaining = DB::table('tenant_users')
                        ->where('tenant_id', $tenantId)
                        ->count();
                    if ($remaining === 0) {
                        DB::table('tenants')->where('id', $tenantId)->delete();
                    }
                }

                $count++;
            }
        });

        $this->info("Purged {$count} unverified user(s) older than {$hours}h.");

        return self::SUCCESS;
    }

    /**
     * Quién se queda aunque no haya verificado nada.
     */
    private function shouldKeep(UserModel $user): bool
    {
        if (str_ends_with(mb_strtolower((string) $user->email), self::WALK_IN_DOMAIN)) {
            return true;
        }

        return $this->hasHistory($user->id);
    }

    private function hasHistory(string $userId): bool
    {
        foreach (self::HISTORY as $table => $columns) {
            $query = DB::table($table)->where(function ($q) use ($columns, $userId) {
                foreach ($columns as $column) {
                    $q->orWhere($column, $userId);
                }
            });

            if ($query->exists()) {
                return true;
            }
        }

        return false;
    }
}
