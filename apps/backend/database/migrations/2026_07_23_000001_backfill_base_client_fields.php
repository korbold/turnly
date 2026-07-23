<?php

use App\Domain\Tenant\BusinessTypeTemplates;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Append the shared `nombre` + `telefono` base fields (added to every
     * non-car_wash template) to existing tenants that predate the change.
     * Fields the tenant already has by key stay intact — only missing keys
     * are appended. car_wash is skipped because its template excludes the
     * base fields (the plate already identifies the client).
     */
    private const BASE_KEYS = ['nombre', 'telefono'];

    public function up(): void
    {
        $tenants = DB::table('tenants')
            ->whereNotNull('business_type')
            ->where('business_type', '!=', 'car_wash')
            ->whereNull('deleted_at')
            ->get(['id', 'business_type', 'custom_fields']);

        foreach ($tenants as $t) {
            $current = is_string($t->custom_fields)
                ? (json_decode($t->custom_fields, true) ?: [])
                : ((array) ($t->custom_fields ?? []));

            $template = collect(BusinessTypeTemplates::getCustomFields($t->business_type))->keyBy('key');
            $existingKeys = collect($current)->pluck('key')->filter()->all();

            $appended = false;
            foreach (self::BASE_KEYS as $key) {
                if (in_array($key, $existingKeys, true)) continue;
                if (!$template->has($key)) continue;
                $current[] = $template->get($key);
                $appended = true;
            }

            if ($appended) {
                DB::table('tenants')->where('id', $t->id)->update([
                    'custom_fields' => json_encode($current),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        // Additive-safe reverse: drop only the base keys we appended.
        $tenants = DB::table('tenants')
            ->whereNotNull('business_type')
            ->where('business_type', '!=', 'car_wash')
            ->whereNull('deleted_at')
            ->get(['id', 'custom_fields']);

        foreach ($tenants as $t) {
            $current = is_string($t->custom_fields)
                ? (json_decode($t->custom_fields, true) ?: [])
                : ((array) ($t->custom_fields ?? []));

            $filtered = array_values(array_filter(
                $current,
                fn ($f) => !in_array($f['key'] ?? null, self::BASE_KEYS, true)
            ));

            if (count($filtered) !== count($current)) {
                DB::table('tenants')->where('id', $t->id)->update([
                    'custom_fields' => json_encode($filtered),
                    'updated_at' => now(),
                ]);
            }
        }
    }
};
