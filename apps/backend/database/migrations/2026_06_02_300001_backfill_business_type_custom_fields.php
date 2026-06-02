<?php

use App\Domain\Tenant\BusinessTypeTemplates;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Merge the (extended) per-business-type custom field template into
     * every existing tenant. Fields the tenant already has by key stay
     * intact — only missing keys are appended. This lets us roll out
     * new segmentation fields (vehicle_type, segment, patient_segment,
     * etc.) without forcing an onboarding redo.
     */
    public function up(): void
    {
        $tenants = DB::table('tenants')
            ->whereNotNull('business_type')
            ->whereNull('deleted_at')
            ->get(['id', 'business_type', 'custom_fields']);

        foreach ($tenants as $t) {
            $current = is_string($t->custom_fields)
                ? (json_decode($t->custom_fields, true) ?: [])
                : ((array) ($t->custom_fields ?? []));

            $template = BusinessTypeTemplates::getCustomFields($t->business_type);
            if (empty($template)) continue;

            $existingKeys = collect($current)->pluck('key')->filter()->all();

            $appended = false;
            foreach ($template as $field) {
                $key = $field['key'] ?? null;
                if (!$key || in_array($key, $existingKeys, true)) continue;
                $current[] = $field;
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
        // Reversible: we just re-apply the *current* template, dropping
        // keys that aren't part of the original definition.
        $tenants = DB::table('tenants')
            ->whereNotNull('business_type')
            ->whereNull('deleted_at')
            ->get(['id', 'business_type']);

        foreach ($tenants as $t) {
            DB::table('tenants')->where('id', $t->id)->update([
                'custom_fields' => json_encode(BusinessTypeTemplates::getCustomFields($t->business_type)),
                'updated_at' => now(),
            ]);
        }
    }
};
