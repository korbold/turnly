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
    $barberSegment = $barber->firstWhere('key', 'segment');
    expect($barberSegment['locked'])->toBeTrue();
    expect($barberSegment)->not->toHaveKey('variant_map');

    $spa = collect(BusinessTypeTemplates::getCustomFields('spa'));
    expect($spa->firstWhere('key', 'gender'))->not->toBeNull();
    $spaGender = $spa->firstWhere('key', 'gender');
    expect($spaGender['locked'])->toBeTrue();
    expect($spaGender)->not->toHaveKey('variant_map');

    $medical = collect(BusinessTypeTemplates::getCustomFields('medical'));
    expect($medical->firstWhere('key', 'patient_segment'))->not->toBeNull();
    $medicalPatient = $medical->firstWhere('key', 'patient_segment');
    expect($medicalPatient['locked'])->toBeTrue();
    expect($medicalPatient)->not->toHaveKey('variant_map');
});

test('gym template stays flat and unrelated to variants', function () {
    $gym = BusinessTypeTemplates::getCustomFields('gym');
    foreach ($gym as $field) {
        expect($field['affects_variant'] ?? false)->toBeFalse();
    }
});
