<?php

namespace Database\Factories;

use App\Infrastructure\Persistence\Models\TenantModel;
use Illuminate\Database\Eloquent\Factories\Factory;

class TenantModelFactory extends Factory
{
    protected $model = TenantModel::class;

    public function definition(): array
    {
        return [
            'slug' => fake()->unique()->slug(2),
            'name' => fake()->company(),
            'owner_name' => fake()->name(),
            'email' => fake()->unique()->companyEmail(),
            'phone' => fake()->phoneNumber(),
            'city' => fake()->city(),
            'country' => 'EC',
            'plan' => 'trial',
            'status' => 'active',
            'trial_ends_at' => now()->addDays(14),
            'settings' => null,
            'onboarding_step' => 0,
            'activated_at' => now(),
        ];
    }

    public function suspended(): static
    {
        return $this->state(['status' => 'suspended']);
    }

    public function pending(): static
    {
        return $this->state(['status' => 'pending', 'activated_at' => null]);
    }
}
