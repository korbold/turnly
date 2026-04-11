<?php

namespace Database\Factories;

use App\Infrastructure\Persistence\Models\AvailabilitySlotModel;
use Illuminate\Database\Eloquent\Factories\Factory;

class AvailabilitySlotModelFactory extends Factory
{
    protected $model = AvailabilitySlotModel::class;

    public function definition(): array
    {
        $startHour = fake()->numberBetween(7, 16);
        $endHour   = $startHour + fake()->numberBetween(1, 4);
        $endHour   = min($endHour, 20);

        $startTime = sprintf('%02d:00:00', $startHour);
        $endTime   = sprintf('%02d:00:00', $endHour);

        return [
            'tenant_id'      => null, // must be set by the caller
            'day_of_week'    => fake()->numberBetween(0, 6),
            'start_time'     => $startTime,
            'end_time'       => $endTime,
            'max_concurrent' => fake()->numberBetween(1, 3),
            'is_active'      => true,
        ];
    }

    public function inactive(): static
    {
        return $this->state(['is_active' => false]);
    }

    public function forDay(int $day): static
    {
        return $this->state(['day_of_week' => $day]);
    }
}
