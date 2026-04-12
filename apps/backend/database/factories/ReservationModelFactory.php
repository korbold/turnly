<?php

namespace Database\Factories;

use App\Infrastructure\Persistence\Models\ReservationModel;
use Illuminate\Database\Eloquent\Factories\Factory;

class ReservationModelFactory extends Factory
{
    protected $model = ReservationModel::class;

    public function definition(): array
    {
        $scheduledAt  = fake()->dateTimeBetween('now', '+30 days');
        $estimatedEnd = (clone $scheduledAt)->modify('+30 minutes');

        return [
            'tenant_id'    => null, // must be set by the caller
            'client_id'    => null, // must be set by the caller
            'client_resource_id' => null, // must be set by the caller
            'service_id'   => null, // must be set by the caller
            'assigned_to'  => null,
            'created_by'   => null, // must be set by the caller
            'scheduled_at' => $scheduledAt,
            'estimated_end'=> $estimatedEnd,
            'status'       => 'pending',
            'notes'        => fake()->optional(0.3)->sentence(),
            'cancelled_at' => null,
            'cancel_reason'=> null,
        ];
    }

    public function confirmed(): static
    {
        return $this->state(['status' => 'confirmed']);
    }

    public function cancelled(): static
    {
        return $this->state([
            'status'        => 'cancelled',
            'cancelled_at'  => now(),
            'cancel_reason' => fake()->sentence(),
        ]);
    }

    public function completed(): static
    {
        return $this->state(['status' => 'completed']);
    }
}
