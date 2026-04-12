<?php

namespace App\Domain\Tenant;

class BusinessTypeTemplates
{
    public static function getCustomFields(string $type): array
    {
        return match ($type) {
            'car_wash' => [
                ['key' => 'plate', 'label' => 'Placa', 'type' => 'text', 'required' => true, 'options' => null],
                ['key' => 'brand', 'label' => 'Marca', 'type' => 'text', 'required' => false, 'options' => null],
                ['key' => 'model', 'label' => 'Modelo', 'type' => 'text', 'required' => false, 'options' => null],
                ['key' => 'color', 'label' => 'Color', 'type' => 'text', 'required' => false, 'options' => null],
            ],
            'medical' => [
                ['key' => 'allergies', 'label' => 'Alergias', 'type' => 'textarea', 'required' => false, 'options' => null],
                ['key' => 'blood_type', 'label' => 'Tipo de sangre', 'type' => 'text', 'required' => false, 'options' => null],
            ],
            'gym' => [
                ['key' => 'goal', 'label' => 'Objetivo', 'type' => 'text', 'required' => false, 'options' => null],
            ],
            default => [],
        };
    }

    public static function getSuggestedServices(string $type): array
    {
        return match ($type) {
            'car_wash' => [
                ['name' => 'Lavado básico', 'price' => 5.00, 'description' => 'Lavado exterior completo'],
                ['name' => 'Lavado completo', 'price' => 10.00, 'description' => 'Lavado exterior e interior'],
                ['name' => 'Aspirado', 'price' => 8.00, 'description' => 'Aspirado profundo del interior'],
                ['name' => 'Encerado', 'price' => 15.00, 'description' => 'Encerado de carrocería'],
            ],
            'barbershop' => [
                ['name' => 'Corte clásico', 'price' => 5.00, 'description' => 'Corte de cabello clásico'],
                ['name' => 'Barba', 'price' => 3.00, 'description' => 'Arreglo de barba'],
                ['name' => 'Corte + Barba', 'price' => 7.00, 'description' => 'Corte y arreglo de barba'],
            ],
            'medical' => [
                ['name' => 'Consulta general', 'price' => 25.00, 'description' => 'Consulta médica general'],
                ['name' => 'Control', 'price' => 15.00, 'description' => 'Consulta de control'],
            ],
            'spa' => [
                ['name' => 'Masaje relajante', 'price' => 20.00, 'description' => 'Masaje corporal relajante'],
                ['name' => 'Facial', 'price' => 15.00, 'description' => 'Tratamiento facial'],
            ],
            'gym' => [
                ['name' => 'Clase grupal', 'price' => 5.00, 'description' => 'Clase grupal de ejercicio'],
                ['name' => 'Personal trainer', 'price' => 15.00, 'description' => 'Sesión con entrenador personal'],
            ],
            default => [],
        };
    }

    public static function getDefaultFeatures(string $type): array
    {
        return match ($type) {
            'car_wash' => ['client_resources' => true, 'walk_ins' => true, 'payment_tracking' => true],
            'barbershop' => ['client_resources' => false, 'walk_ins' => true, 'payment_tracking' => true],
            'medical' => ['client_resources' => true, 'walk_ins' => false, 'payment_tracking' => true],
            'spa' => ['client_resources' => false, 'walk_ins' => true, 'payment_tracking' => true],
            'gym' => ['client_resources' => true, 'walk_ins' => false, 'payment_tracking' => false],
            default => ['client_resources' => false, 'walk_ins' => true, 'payment_tracking' => true],
        };
    }
}
