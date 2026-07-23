<?php

use App\Infrastructure\Persistence\Models\TenantModel;

function runBackfillBaseClientFields(): void
{
    $migration = require base_path('database/migrations/2026_07_23_000001_backfill_base_client_fields.php');
    $migration->up();
}

test('backfill appends nombre + telefono to a business missing them, keeping existing fields', function () {
    $tenant = TenantModel::factory()->create([
        'business_type' => 'barbershop',
        'custom_fields' => [
            ['key' => 'segment', 'label' => 'Segmento', 'type' => 'select', 'required' => false, 'options' => ['Niño', 'Adulto'], 'affects_variant' => true, 'locked' => true],
        ],
    ]);

    runBackfillBaseClientFields();

    $keys = collect($tenant->fresh()->custom_fields)->pluck('key')->all();
    expect($keys)->toContain('nombre', 'telefono', 'segment');
});

test('backfill is idempotent — a business already carrying nombre is left intact', function () {
    $tenant = TenantModel::factory()->create([
        'business_type' => 'barbershop',
        'custom_fields' => [
            ['key' => 'nombre', 'label' => 'Nombre y apellido', 'type' => 'text', 'required' => true, 'options' => null],
            ['key' => 'telefono', 'label' => 'Teléfono', 'type' => 'text', 'required' => false, 'options' => null],
            ['key' => 'segment', 'label' => 'Segmento', 'type' => 'select', 'required' => false, 'options' => ['Niño'], 'affects_variant' => true, 'locked' => true],
        ],
    ]);

    runBackfillBaseClientFields();

    $fields = collect($tenant->fresh()->custom_fields);
    expect($fields->where('key', 'nombre')->count())->toBe(1);
    expect($fields->firstWhere('key', 'nombre')['label'])->toBe('Nombre y apellido');
});

test('backfill does not touch car_wash businesses', function () {
    $tenant = TenantModel::factory()->create([
        'business_type' => 'car_wash',
        'custom_fields' => [
            ['key' => 'plate', 'label' => 'Placa', 'type' => 'text', 'required' => true, 'options' => null, 'capitalize' => 'uppercase'],
        ],
    ]);

    runBackfillBaseClientFields();

    $keys = collect($tenant->fresh()->custom_fields)->pluck('key')->all();
    expect($keys)->not->toContain('nombre');
    expect($keys)->not->toContain('telefono');
});
