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
                'slug'           => 'barber-demo',
                'name'           => 'Barbería López',
                'owner_name'     => 'Carlos López',
                'email'          => 'lopez@turnly.com',
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
                'slug'           => 'spa-demo',
                'name'           => 'Spa Centro',
                'owner_name'     => 'María Fernanda Torres',
                'email'          => 'spa@turnly.com',
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
