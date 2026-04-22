<?php

namespace Database\Seeders;

use App\Infrastructure\Persistence\Models\PlanModel;
use Illuminate\Database\Seeder;

class PlanSeeder extends Seeder
{
    public function run(): void
    {
        $plans = [
            [
                'name' => 'Gratis',
                'slug' => 'free',
                'price' => 0,
                'max_services' => 1,
                'max_reservations_per_month' => 30,
                'max_employees' => 0,
                'has_push_notifications' => false,
                'has_reports' => false,
                'has_reminders' => false,
                'has_custom_page' => false,
                'sort_order' => 1,
                'description' => 'Para empezar. 1 servicio, 30 reservas/mes.',
            ],
            [
                'name' => 'Básico',
                'slug' => 'basic',
                'price' => 9.99,
                'max_services' => 5,
                'max_reservations_per_month' => null,
                'max_employees' => 1,
                'has_push_notifications' => true,
                'has_reports' => false,
                'has_reminders' => false,
                'has_custom_page' => false,
                'sort_order' => 2,
                'description' => '5 servicios, reservas ilimitadas, 1 empleado.',
            ],
            [
                'name' => 'Pro',
                'slug' => 'pro',
                'price' => 19.99,
                'max_services' => null,
                'max_reservations_per_month' => null,
                'max_employees' => null,
                'has_push_notifications' => true,
                'has_reports' => true,
                'has_reminders' => true,
                'has_custom_page' => false,
                'sort_order' => 3,
                'description' => 'Todo ilimitado, reportes y recordatorios.',
            ],
            [
                'name' => 'Premium',
                'slug' => 'premium',
                'price' => 29.99,
                'max_services' => null,
                'max_reservations_per_month' => null,
                'max_employees' => null,
                'has_push_notifications' => true,
                'has_reports' => true,
                'has_reminders' => true,
                'has_custom_page' => true,
                'sort_order' => 4,
                'description' => 'Todo + página pública personalizada, soporte prioritario.',
            ],
        ];

        foreach ($plans as $plan) {
            PlanModel::updateOrCreate(['slug' => $plan['slug']], $plan);
        }
    }
}
