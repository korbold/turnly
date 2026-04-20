<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $now = now()->toDateTimeString();
        $driver = DB::getDriverName();

        // Find users who are clients in reservations but don't have a tenant_users
        // record, and create one with role 'client'.
        DB::statement("
            INSERT INTO tenant_users (tenant_id, user_id, role, is_active, created_at, updated_at)
            SELECT DISTINCT r.tenant_id, r.client_id, 'client', 1, ?, ?
            FROM reservations r
            WHERE NOT EXISTS (
                SELECT 1 FROM tenant_users tu
                WHERE tu.tenant_id = r.tenant_id AND tu.user_id = r.client_id
            )
        ", [$now, $now]);

        // For users who already have a tenant_users record but with a non-client role
        // (e.g. staff who were mistakenly used as clients), we leave them as-is
        // since they are actual staff members.

        // Update tenant_users records that have no role set (NULL) for users
        // who appear as clients in reservations.
        if ($driver === 'sqlite') {
            DB::statement("
                UPDATE tenant_users
                SET role = 'client', updated_at = ?
                WHERE role IS NULL
                  AND EXISTS (
                    SELECT 1 FROM reservations r
                    WHERE r.tenant_id = tenant_users.tenant_id
                      AND r.client_id = tenant_users.user_id
                  )
            ", [$now]);
        } else {
            DB::statement("
                UPDATE tenant_users tu
                INNER JOIN reservations r ON tu.tenant_id = r.tenant_id AND tu.user_id = r.client_id
                SET tu.role = 'client', tu.updated_at = ?
                WHERE tu.role IS NULL
            ", [$now]);
        }
    }

    public function down(): void
    {
        // Not reversible — we can't know which records were created by this migration.
    }
};
