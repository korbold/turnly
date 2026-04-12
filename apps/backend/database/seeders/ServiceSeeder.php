<?php

namespace Database\Seeders;

use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class ServiceSeeder extends Seeder
{
    public function run(): void
    {
        $services = [
            [
                'name'        => 'Lavado Básico',
                'description' => 'Lavado exterior completo del vehículo.',
                'price'       => '5.00',
                'sort_order'  => 1,
            ],
            [
                'name'        => 'Lavado Completo',
                'description' => 'Lavado exterior e interior del vehículo.',
                'price'       => '10.00',
                'sort_order'  => 2,
            ],
            [
                'name'        => 'Aspirado Interior',
                'description' => 'Aspirado profundo del habitáculo.',
                'price'       => '8.00',
                'sort_order'  => 3,
            ],
            [
                'name'        => 'Encerado Premium',
                'description' => 'Encerado de carrocería para máximo brillo y protección.',
                'price'       => '15.00',
                'sort_order'  => 4,
            ],
        ];

        $tenants = TenantModel::all();

        foreach ($tenants as $tenant) {
            foreach ($services as $service) {
                ServiceModel::withoutGlobalScopes()->create(array_merge($service, [
                    'id'        => Str::uuid(),
                    'tenant_id' => $tenant->id,
                    'is_active' => true,
                ]));
            }
        }
    }
}
