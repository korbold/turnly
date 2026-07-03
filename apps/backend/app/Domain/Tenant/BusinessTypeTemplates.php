<?php

namespace App\Domain\Tenant;

class BusinessTypeTemplates
{
    /**
     * Resource custom fields per business type. Surfaces both basic
     * input fields (placa/marca/etc.) and the segmentation field that
     * drives variant auto-suggestion when the customer books a service.
     *
     * Field shape:
     *   - key:        snake_case identifier; stored under `resource.data[key]`
     *   - label:      Spanish UI label
     *   - type:       'text' | 'textarea' | 'number' | 'select'
     *   - required:   bool
     *   - options:    string[] (only for `select`) — human labels
     *   - capitalize: 'uppercase' | 'capitalize' | 'lowercase' (optional)
     *   - affects_variant: bool — if true, this field drives variant matching;
     *                      the field is system-locked (locked === true) so its
     *                      option labels never change (add-only via LockedCustomFields).
     *                      Matching now uses service_variants.vehicle_types directly.
     *   - locked:     bool — if true, options are add-only; field cannot be dropped.
     *                  Always true when affects_variant === true.
     */
    public static function getCustomFields(string $type): array
    {
        return match ($type) {
            'car_wash' => [
                ['key' => 'plate', 'label' => 'Placa', 'type' => 'text', 'required' => true, 'options' => null, 'capitalize' => 'uppercase'],
                ['key' => 'brand', 'label' => 'Marca', 'type' => 'text', 'required' => false, 'options' => null, 'capitalize' => 'capitalize'],
                ['key' => 'model', 'label' => 'Modelo', 'type' => 'text', 'required' => false, 'options' => null, 'capitalize' => 'capitalize'],
                ['key' => 'color', 'label' => 'Color', 'type' => 'text', 'required' => false, 'options' => null, 'capitalize' => 'capitalize'],
                [
                    'key' => 'vehicle_type',
                    'label' => 'Tipo de vehículo',
                    'type' => 'select',
                    'required' => true,
                    'options' => ['Sedán', 'Hatchback', 'SUV', 'Camioneta', 'Camión / Van'],
                    'affects_variant' => true,
                    'locked' => true,
                ],
            ],
            'barbershop' => [
                [
                    'key' => 'segment',
                    'label' => 'Segmento',
                    'type' => 'select',
                    'required' => false,
                    'options' => ['Niño', 'Adulto', 'Adulto mayor'],
                    'affects_variant' => true,
                    'locked' => true,
                ],
            ],
            'spa' => [
                [
                    'key' => 'gender',
                    'label' => 'Género',
                    'type' => 'select',
                    'required' => false,
                    'options' => ['Mujer', 'Hombre', 'Unisex'],
                    'affects_variant' => true,
                    'locked' => true,
                ],
            ],
            'medical' => [
                ['key' => 'allergies', 'label' => 'Alergias', 'type' => 'textarea', 'required' => false, 'options' => null],
                ['key' => 'blood_type', 'label' => 'Tipo de sangre', 'type' => 'text', 'required' => false, 'options' => null],
                [
                    'key' => 'patient_segment',
                    'label' => 'Segmento paciente',
                    'type' => 'select',
                    'required' => true,
                    'options' => ['Pediátrico', 'Adulto', 'Geriátrico'],
                    'affects_variant' => true,
                    'locked' => true,
                ],
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
