<?php

use App\Domain\Tenant\LockedCustomFields;
use Illuminate\Validation\ValidationException;

function lcfLockedField(array $options): array {
    return ['key' => 'vehicle_type', 'label' => 'Tipo de vehículo', 'type' => 'select',
            'required' => true, 'affects_variant' => true, 'locked' => true, 'options' => $options];
}

it('re-injects a locked field the client tried to drop', function () {
    $existing = [lcfLockedField(['Sedán', 'SUV'])];
    $result = LockedCustomFields::reconcile([], $existing);
    expect($result)->toHaveCount(1)
        ->and($result[0]['key'])->toBe('vehicle_type');
});

it('allows appending new options to a locked field', function () {
    $existing = [lcfLockedField(['Sedán', 'SUV'])];
    $incoming = [lcfLockedField(['Sedán', 'SUV', 'Moto'])];
    $result = LockedCustomFields::reconcile($incoming, $existing);
    expect($result[0]['options'])->toEqual(['Sedán', 'SUV', 'Moto']);
});

it('rejects removing or renaming a seeded option', function () {
    $existing = [lcfLockedField(['Sedán', 'SUV'])];
    $incoming = [lcfLockedField(['Sedan', 'SUV'])]; // renamed Sedán -> Sedan
    expect(fn () => LockedCustomFields::reconcile($incoming, $existing))
        ->toThrow(ValidationException::class);
});

it('leaves non-locked fields untouched', function () {
    $existing = [lcfLockedField(['Sedán'])];
    $incoming = [
        lcfLockedField(['Sedán']),
        ['key' => 'plate', 'label' => 'Placa', 'type' => 'text', 'required' => true],
    ];
    $result = LockedCustomFields::reconcile($incoming, $existing);
    expect($result)->toHaveCount(2)->and($result[1]['key'])->toBe('plate');
});

// HTTP-level tests

use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;

it('rejects deleting a locked field via the settings endpoint', function () {
    $tenant = TenantModel::factory()->create([
        'business_type' => 'car_wash',
        'custom_fields' => [lcfLockedField(['Sedán', 'SUV'])],
    ]);
    $user = UserModel::factory()->create();

    app()->instance('current_tenant', $tenant);
    app()->instance('current_tenant_id', $tenant->id);

    // Attempt to overwrite custom_fields without the locked field
    $this->actingAs($user)
        ->withHeader('X-Tenant', $tenant->slug)
        ->patchJson('/api/v1/tenant/settings', [
            'custom_fields' => [['key' => 'plate', 'label' => 'Placa', 'type' => 'text', 'required' => true]],
        ])
        ->assertOk();

    $tenant->refresh();
    $keys = collect($tenant->custom_fields)->pluck('key');
    expect($keys)->toContain('vehicle_type'); // re-injected, not dropped
});
