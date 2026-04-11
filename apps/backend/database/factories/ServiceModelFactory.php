<?php

namespace Database\Factories;

use App\Infrastructure\Persistence\Models\ServiceModel;
use Illuminate\Database\Eloquent\Factories\Factory;

class ServiceModelFactory extends Factory
{
    protected $model = ServiceModel::class;

    public function definition(): array
    {
        $services = [
            ['name' => 'Basic Exterior Wash',    'duration' => 15],
            ['name' => 'Full Exterior Wash',     'duration' => 20],
            ['name' => 'Interior Cleaning',      'duration' => 30],
            ['name' => 'Full Detail',            'duration' => 60],
            ['name' => 'Express Wash',           'duration' => 10],
            ['name' => 'Premium Wash & Wax',     'duration' => 45],
            ['name' => 'Engine Bay Cleaning',    'duration' => 30],
            ['name' => 'Ceramic Coating',        'duration' => 60],
            ['name' => 'Upholstery Shampoo',     'duration' => 45],
            ['name' => 'Tire & Rim Detailing',   'duration' => 20],
        ];

        $service = fake()->randomElement($services);

        return [
            'tenant_id'        => null, // must be set by the caller
            'name'             => $service['name'],
            'description'      => fake()->sentence(),
            'price'            => fake()->randomFloat(2, 5, 20),
            'duration_minutes' => $service['duration'],
            'is_active'        => true,
            'sort_order'       => fake()->numberBetween(1, 100),
        ];
    }

    public function inactive(): static
    {
        return $this->state(['is_active' => false]);
    }
}
