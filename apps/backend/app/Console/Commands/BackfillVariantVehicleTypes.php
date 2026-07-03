<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Infrastructure\Persistence\Models\ServiceVariantModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use Illuminate\Console\Command;

class BackfillVariantVehicleTypes extends Command
{
    protected $signature = 'variants:backfill-vehicle-types {--dry-run}';
    protected $description = 'Populate service_variants.vehicle_types from legacy variant_map keyword matching';

    public function handle(): int
    {
        $dry = (bool) $this->option('dry-run');
        $filled = 0; $empty = 0;

        foreach (TenantModel::all() as $tenant) {
            $fields = is_array($tenant->custom_fields) ? $tenant->custom_fields : [];
            $field = collect($fields)->first(fn ($f) => ($f['affects_variant'] ?? false) === true);
            $map = is_array($field['variant_map'] ?? null) ? $field['variant_map'] : [];
            if (empty($map)) continue;

            $variants = ServiceVariantModel::withoutGlobalScopes()
                ->where('tenant_id', $tenant->id)->get();

            foreach ($variants as $variant) {
                if (!empty($variant->vehicle_types)) continue;
                $label = mb_strtolower((string) $variant->label);

                $types = [];
                foreach ($map as $optionValue => $keywords) {
                    foreach ((array) $keywords as $kw) {
                        if ($kw !== '' && str_contains($label, mb_strtolower((string) $kw))) {
                            $types[] = $optionValue;
                            break;
                        }
                    }
                }
                $types = array_values(array_unique($types));

                if (empty($types)) {
                    $empty++;
                    $this->warn("EMPTY  {$tenant->slug} / {$variant->label} ({$variant->id})");
                    continue;
                }
                $filled++;
                $this->line("FILL   {$tenant->slug} / {$variant->label} -> " . implode(', ', $types));
                if (!$dry) $variant->update(['vehicle_types' => $types]);
            }
        }

        $this->info(($dry ? '[dry-run] ' : '') . "Filled {$filled}, left empty {$empty} (need manual tagging).");
        return self::SUCCESS;
    }
}
