<?php

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * One-time repair for walk-ins created before the extractClientName fix.
     * Those were saved with `client_id` = the admin's own staff user id (the
     * name field is labelled "Nombre", which the old matcher required to also
     * contain "cliente"). The browse staff-exclusion filter then hid them.
     *
     * For each resource owned by a STAFF user that carries a `nombre` value in
     * its data bag, resolve/create a real client-role user and reassign the
     * resource to it — same shape as ClientResourceController::findOrCreateClient.
     * Resources without a name are left alone (could be a staff member's own
     * vehicle, not a mis-saved walk-in).
     */
    public function up(): void
    {
        $staffByTenant = TenantUserModel::where('role', '!=', 'client')
            ->get(['tenant_id', 'user_id'])
            ->groupBy('tenant_id')
            ->map(fn ($rows) => $rows->pluck('user_id')->all());

        foreach ($staffByTenant as $tenantId => $staffIds) {
            $resources = ClientResourceModel::where('tenant_id', $tenantId)
                ->whereIn('client_id', $staffIds)
                ->get();

            foreach ($resources as $resource) {
                $data = is_string($resource->data)
                    ? (json_decode($resource->data, true) ?: [])
                    : ((array) ($resource->data ?? []));

                $name = trim((string) ($data['nombre'] ?? ''));
                if ($name === '') continue;

                $client = $this->findOrCreateClient($name, $tenantId);
                if ($client->id === $resource->client_id) continue;

                $resource->update(['client_id' => $client->id]);
            }
        }
    }

    public function down(): void
    {
        // Not reversible: we cannot know which resources were originally
        // mis-owned. No-op.
    }

    private function findOrCreateClient(string $name, string $tenantId): UserModel
    {
        $existing = UserModel::whereHas('tenants', function ($q) use ($tenantId) {
            $q->where('tenants.id', $tenantId)->where('tenant_users.role', 'client');
        })->where('name', $name)->first();

        if ($existing) {
            return $existing;
        }

        $user = UserModel::create([
            'name' => $name,
            'email' => Str::slug($name) . '-' . Str::random(4) . '@client.local',
            'password' => bcrypt(Str::random(16)),
        ]);

        TenantUserModel::create([
            'tenant_id' => $tenantId,
            'user_id' => $user->id,
            'role' => 'client',
            'is_active' => true,
        ]);

        return $user;
    }
};
