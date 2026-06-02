<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * For every existing service create a "default" variant that
     * mirrors its current price + a sensible duration. This keeps
     * legacy reservations/service-logs that still reference the
     * parent service working while new flows pivot to variants.
     */
    public function up(): void
    {
        $services = DB::table('services')->whereNull('deleted_at')->get();

        foreach ($services as $service) {
            // Skip if a variant already exists (idempotency for re-runs).
            $exists = DB::table('service_variants')
                ->where('service_id', $service->id)
                ->exists();

            if ($exists) {
                continue;
            }

            DB::table('service_variants')->insert([
                'id'           => (string) Str::uuid(),
                'tenant_id'    => $service->tenant_id,
                'service_id'   => $service->id,
                'label'        => 'Default',
                'price'        => $service->price ?? 0,
                'duration_min' => 30,
                'sort_order'   => 0,
                'is_active'    => true,
                'created_at'   => now(),
                'updated_at'   => now(),
            ]);
        }
    }

    public function down(): void
    {
        // Remove only the labeled "Default" variants we created.
        DB::table('service_variants')->where('label', 'Default')->delete();
    }
};
