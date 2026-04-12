<?php

namespace Database\Factories;

use App\Infrastructure\Persistence\Models\ServiceLogModel;
use Illuminate\Database\Eloquent\Factories\Factory;

class ServiceLogModelFactory extends Factory
{
    protected $model = ServiceLogModel::class;

    public function definition(): array
    {
        $startedAt = now()->subMinutes(fake()->numberBetween(5, 120));

        return [
            'tenant_id'          => null, // must be set by the caller
            'client_resource_id' => null, // must be set by the caller
            'service_id'         => null, // must be set by the caller
            'reservation_id'     => null,
            'attended_by'        => null, // must be set by the caller
            'created_by'         => null, // must be set by the caller
            'started_at'         => $startedAt,
            'finished_at'        => null,
            'price_charged'      => fake()->randomFloat(2, 5, 20),
            'payment_method'     => fake()->randomElement(['cash', 'card', 'transfer']),
            'status'             => 'in_progress',
            'notes'              => fake()->optional(0.2)->sentence(),
            'log_date'           => now()->toDateString(),
        ];
    }

    public function completed(): static
    {
        return $this->state(function () {
            $startedAt  = now()->subMinutes(fake()->numberBetween(20, 90));
            $finishedAt = (clone $startedAt)->modify('+' . fake()->numberBetween(10, 60) . ' minutes');

            return [
                'status'      => 'completed',
                'started_at'  => $startedAt,
                'finished_at' => $finishedAt,
            ];
        });
    }

    public function cash(): static
    {
        return $this->state(['payment_method' => 'cash']);
    }

    public function card(): static
    {
        return $this->state(['payment_method' => 'card']);
    }
}
