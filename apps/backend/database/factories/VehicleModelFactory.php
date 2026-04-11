<?php

namespace Database\Factories;

use App\Infrastructure\Persistence\Models\VehicleModel;
use Illuminate\Database\Eloquent\Factories\Factory;

class VehicleModelFactory extends Factory
{
    protected $model = VehicleModel::class;

    public function definition(): array
    {
        $brands = ['Toyota', 'Chevrolet', 'Hyundai', 'Kia', 'Nissan', 'Ford', 'Mazda', 'Honda'];
        $models = [
            'Toyota'    => ['Corolla', 'Hilux', 'RAV4', 'Fortuner', 'Yaris'],
            'Chevrolet' => ['Aveo', 'Sail', 'Tracker', 'Spark', 'Captiva'],
            'Hyundai'   => ['Tucson', 'Accent', 'i10', 'Santa Fe', 'Elantra'],
            'Kia'       => ['Sportage', 'Picanto', 'Rio', 'Sorento', 'Stonic'],
            'Nissan'    => ['Sentra', 'Kicks', 'Frontier', 'X-Trail', 'Versa'],
            'Ford'      => ['Ranger', 'Explorer', 'EcoSport', 'Escape', 'F-150'],
            'Mazda'     => ['CX-5', 'Mazda3', 'Mazda6', 'CX-30', 'MX-5'],
            'Honda'     => ['Civic', 'CR-V', 'HR-V', 'Accord', 'Pilot'],
        ];
        $colors = ['White', 'Black', 'Silver', 'Gray', 'Red', 'Blue', 'Green', 'Yellow', 'Orange'];
        $types  = ['sedan', 'suv', 'pickup', 'hatchback', 'van', 'coupe'];

        $brand = fake()->randomElement($brands);
        $model = fake()->randomElement($models[$brand]);

        $letters = strtoupper(fake()->lexify('???'));
        $digits   = fake()->numerify('####');
        $plate    = "{$letters}-{$digits}";

        return [
            'tenant_id' => null, // must be set by the caller
            'owner_id'  => null, // must be set by the caller
            'plate'     => $plate,
            'brand'     => $brand,
            'model'     => $model,
            'color'     => fake()->randomElement($colors),
            'type'      => fake()->randomElement($types),
        ];
    }
}
