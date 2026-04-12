<?php

namespace Database\Seeders;

use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use App\Infrastructure\Persistence\Models\VehicleModel;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $tenantLopez  = TenantModel::where('slug', 'lavadora-lopez')->first();
        $tenantSpa    = TenantModel::where('slug', 'auto-spa-centro')->first();

        // ── Super admin ────────────────────────────────────────────────────────
        $superAdmin = UserModel::create([
            'id'             => Str::uuid(),
            'name'           => 'Super Admin',
            'email'          => 'super@washflow.com',
            'password'       => Hash::make('password'),
            'is_super_admin' => true,
        ]);

        // ── Helper: create user + tenant_user pivot ────────────────────────────
        $makeUser = function (array $attrs, TenantModel $tenant, string $role): UserModel {
            $user = UserModel::create(array_merge([
                'id'             => Str::uuid(),
                'is_super_admin' => false,
                'password'       => Hash::make('password'),
            ], $attrs));

            TenantUserModel::create([
                'id'        => Str::uuid(),
                'tenant_id' => $tenant->id,
                'user_id'   => $user->id,
                'role'      => $role,
                'is_active' => true,
            ]);

            return $user;
        };

        // ── Lavadora López ─────────────────────────────────────────────────────
        $adminLopez = $makeUser([
            'name'  => 'Admin Lavadora López',
            'email' => 'admin@lavadora-lopez.com',
            'phone' => '+593911000001',
        ], $tenantLopez, 'tenant_admin');

        $cashierLopez = $makeUser([
            'name'  => 'Cajero Lavadora López',
            'email' => 'cajero@lavadora-lopez.com',
            'phone' => '+593911000002',
        ], $tenantLopez, 'cashier');

        $washerLopez = $makeUser([
            'name'  => 'Lavador Lavadora López',
            'email' => 'lavador@lavadora-lopez.com',
            'phone' => '+593911000003',
        ], $tenantLopez, 'washer');

        // Clients 1-5 for Lavadora López
        $clientsLopezData = [
            ['name' => 'Ana Ramírez',    'email' => 'cliente1@example.com', 'phone' => '+593921000001', 'plate' => 'PBA-1234', 'brand' => 'Toyota',    'model' => 'Corolla',  'color' => 'Blanco',  'type' => 'sedan'],
            ['name' => 'Luis Morales',   'email' => 'cliente2@example.com', 'phone' => '+593921000002', 'plate' => 'AAB-5678', 'brand' => 'Chevrolet', 'model' => 'Sail',     'color' => 'Gris',    'type' => 'sedan'],
            ['name' => 'Sofía Castro',   'email' => 'cliente3@example.com', 'phone' => '+593921000003', 'plate' => 'PAA-9012', 'brand' => 'Kia',       'model' => 'Sportage', 'color' => 'Negro',   'type' => 'suv'],
            ['name' => 'Diego Herrera',  'email' => 'cliente4@example.com', 'phone' => '+593921000004', 'plate' => 'PBB-3456', 'brand' => 'Hyundai',   'model' => 'Accent',   'color' => 'Rojo',    'type' => 'sedan'],
            ['name' => 'Valeria Flores', 'email' => 'cliente5@example.com', 'phone' => '+593921000005', 'plate' => 'PAC-7890', 'brand' => 'Mazda',     'model' => 'CX-5',     'color' => 'Azul',    'type' => 'suv'],
        ];

        foreach ($clientsLopezData as $data) {
            $client = $makeUser([
                'name'  => $data['name'],
                'email' => $data['email'],
                'phone' => $data['phone'],
            ], $tenantLopez, 'client');

            VehicleModel::withoutGlobalScopes()->create([
                'id'        => Str::uuid(),
                'tenant_id' => $tenantLopez->id,
                'owner_id'  => $client->id,
                'plate'     => $data['plate'],
                'brand'     => $data['brand'],
                'model'     => $data['model'],
                'color'     => $data['color'],
                'type'      => $data['type'],
            ]);
        }

        // ── Auto Spa Centro ────────────────────────────────────────────────────
        $adminSpa = $makeUser([
            'name'  => 'Admin Auto Spa Centro',
            'email' => 'admin@auto-spa.com',
            'phone' => '+593911000011',
        ], $tenantSpa, 'tenant_admin');

        $cashierSpa = $makeUser([
            'name'  => 'Cajero Auto Spa Centro',
            'email' => 'cajero@auto-spa.com',
            'phone' => '+593911000012',
        ], $tenantSpa, 'cashier');

        $washerSpa = $makeUser([
            'name'  => 'Lavador Auto Spa Centro',
            'email' => 'lavador@auto-spa.com',
            'phone' => '+593911000013',
        ], $tenantSpa, 'washer');

        // Clients 6-10 for Auto Spa Centro
        $clientsSpaData = [
            ['name' => 'Gabriela Vega',    'email' => 'cliente6@example.com',  'phone' => '+593921000006', 'plate' => 'GYE-5678', 'brand' => 'Nissan',    'model' => 'Sentra',   'color' => 'Plateado', 'type' => 'sedan'],
            ['name' => 'Roberto Espinoza', 'email' => 'cliente7@example.com',  'phone' => '+593921000007', 'plate' => 'GBA-1122', 'brand' => 'Ford',      'model' => 'Escape',   'color' => 'Blanco',   'type' => 'suv'],
            ['name' => 'Carmen Ortiz',     'email' => 'cliente8@example.com',  'phone' => '+593921000008', 'plate' => 'GBB-3344', 'brand' => 'Volkswagen','model' => 'Gol',      'color' => 'Verde',    'type' => 'hatchback'],
            ['name' => 'Andrés Mendoza',   'email' => 'cliente9@example.com',  'phone' => '+593921000009', 'plate' => 'GBC-5566', 'brand' => 'Chevrolet', 'model' => 'Tracker',  'color' => 'Negro',    'type' => 'suv'],
            ['name' => 'Paola Suárez',     'email' => 'cliente10@example.com', 'phone' => '+593921000010', 'plate' => 'GBD-7788', 'brand' => 'Toyota',    'model' => 'Yaris',    'color' => 'Rojo',     'type' => 'hatchback'],
        ];

        foreach ($clientsSpaData as $data) {
            $client = $makeUser([
                'name'  => $data['name'],
                'email' => $data['email'],
                'phone' => $data['phone'],
            ], $tenantSpa, 'client');

            VehicleModel::withoutGlobalScopes()->create([
                'id'        => Str::uuid(),
                'tenant_id' => $tenantSpa->id,
                'owner_id'  => $client->id,
                'plate'     => $data['plate'],
                'brand'     => $data['brand'],
                'model'     => $data['model'],
                'color'     => $data['color'],
                'type'      => $data['type'],
            ]);
        }
    }
}
