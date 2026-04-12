<?php

namespace Database\Factories;

use App\Infrastructure\Persistence\Models\ServiceModel;
use Illuminate\Database\Eloquent\Factories\Factory;

class ServiceModelFactory extends Factory
{
    protected $model = ServiceModel::class;

    public function definition(): array
    {
        $names = [
            'Basic Exterior Wash',
            'Full Exterior Wash',
            'Interior Cleaning',
            'Full Detail',
            'Express Wash',
            'Premium Wash & Wax',
            'Engine Bay Cleaning',
            'Ceramic Coating',
            'Upholstery Shampoo',
            'Tire & Rim Detailing',
        ];

        return [
            'tenant_id'  => null, // must be set by the caller
            'name'       => fake()->randomElement($names),
            'description' => fake()->sentence(),
            'price'      => fake()->randomFloat(2, 5, 20),
            'is_active'  => true,
            'sort_order'  => fake()->numberBetween(1, 100),
        ];
    }

    public function inactive(): static
    {
        return $this->state(['is_active' => false]);
    }
}
