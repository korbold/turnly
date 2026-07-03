<?php

use App\Domain\Tenant\BusinessTypeTemplates;

test('car_wash template exposes a vehicle_type select with variant mapping', function () {
    $fields = BusinessTypeTemplates::getCustomFields('car_wash');
    $byKey = collect($fields)->keyBy('key')->all();

    expect($byKey)->toHaveKey('plate');
    expect($byKey)->toHaveKey('vehicle_type');

    $vehicleType = $byKey['vehicle_type'];
    expect($vehicleType['type'])->toBe('select');
    expect($vehicleType['required'])->toBeTrue();
    expect($vehicleType['affects_variant'])->toBeTrue();
    expect($vehicleType['locked'])->toBeTrue();
    expect($vehicleType['options'])->toContain('Sedán', 'Camioneta');
});

test('barbershop, spa, medical templates carry their own affects_variant field', function () {
    $barber = collect(BusinessTypeTemplates::getCustomFields('barbershop'));
    expect($barber->firstWhere('key', 'segment'))->not->toBeNull();

    $spa = collect(BusinessTypeTemplates::getCustomFields('spa'));
    expect($spa->firstWhere('key', 'gender'))->not->toBeNull();

    $medical = collect(BusinessTypeTemplates::getCustomFields('medical'));
    expect($medical->firstWhere('key', 'patient_segment'))->not->toBeNull();
});

test('gym template stays flat and unrelated to variants', function () {
    $gym = BusinessTypeTemplates::getCustomFields('gym');
    foreach ($gym as $field) {
        expect($field['affects_variant'] ?? false)->toBeFalse();
    }
});
