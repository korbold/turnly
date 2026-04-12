<?php

namespace Database\Seeders;

use App\Infrastructure\Persistence\Models\TenantModel;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class TenantSeeder extends Seeder
{
    public function run(): void
    {
        TenantModel::insert([
            [
                'id'             => Str::uuid(),
                'slug'           => 'lavadora-lopez',
                'name'           => 'Lavadora López',
                'owner_name'     => 'Carlos López',
                'email'          => 'lopez@washflow.com',
                'phone'          => '+593987654321',
                'city'           => 'Quito',
                'country'        => 'EC',
                'plan'           => 'basic',
                'status'         => 'active',
                'onboarding_step'=> 0,
                'activated_at'   => now(),
                'created_at'     => now(),
                'updated_at'     => now(),
            ],
            [
                'id'             => Str::uuid(),
                'slug'           => 'auto-spa-centro',
                'name'           => 'Auto Spa Centro',
                'owner_name'     => 'María Fernanda Torres',
                'email'          => 'autospa@washflow.com',
                'phone'          => '+593991234567',
                'city'           => 'Guayaquil',
                'country'        => 'EC',
                'plan'           => 'pro',
                'status'         => 'active',
                'onboarding_step'=> 0,
                'activated_at'   => now(),
                'created_at'     => now(),
                'updated_at'     => now(),
            ],
        ]);
    }
}
