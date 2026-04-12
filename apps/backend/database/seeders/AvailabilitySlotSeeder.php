<?php

namespace Database\Seeders;

use App\Infrastructure\Persistence\Models\AvailabilitySlotModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class AvailabilitySlotSeeder extends Seeder
{
    public function run(): void
    {
        $tenants = TenantModel::all();

        foreach ($tenants as $tenant) {
            // Monday–Friday (day_of_week 0–4): 08:00–18:00
            for ($day = 0; $day <= 4; $day++) {
                AvailabilitySlotModel::withoutGlobalScopes()->create([
                    'id'             => Str::uuid(),
                    'tenant_id'      => $tenant->id,
                    'day_of_week'    => $day,
                    'start_time'     => '08:00:00',
                    'end_time'       => '18:00:00',
                    'max_concurrent' => 2,
                    'is_active'      => true,
                ]);
            }

            // Saturday (day_of_week 5): 08:00–14:00
            AvailabilitySlotModel::withoutGlobalScopes()->create([
                'id'             => Str::uuid(),
                'tenant_id'      => $tenant->id,
                'day_of_week'    => 5,
                'start_time'     => '08:00:00',
                'end_time'       => '14:00:00',
                'max_concurrent' => 2,
                'is_active'      => true,
            ]);

            // Sunday: no slots
        }
    }
}
