<?php

use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

function emissionOwner(TenantModel $tenant): UserModel
{
    $owner = UserModel::factory()->create();
    TenantUserModel::create([
        'id'        => (string) Str::uuid(),
        'tenant_id' => $tenant->id,
        'user_id'   => $owner->id,
        'role'      => 'owner',
        'is_active' => true,
    ]);

    return $owner;
}

function emissionTenant(): TenantModel
{
    $tenant = TenantModel::factory()->create(['status' => 'active']);
    app()->instance('current_tenant', $tenant);
    app()->instance('current_tenant_id', $tenant->id);

    return $tenant;
}

$payload = [
    'ambiente'            => 2,
    'estab'               => '002',
    'pto_emi'             => '001',
    'nombre'              => 'Sucursal Norte',
    'dir_establecimiento' => 'Av. Mariano Acosta 12-30',
];

test('PUT billing-emission forwards the payload to the billing service', function () use ($payload) {
    $tenant = emissionTenant();
    $owner = emissionOwner($tenant);

    Http::fake([
        '*/api/tenant-billing-configs/*/emission' => Http::response([
            'data' => ['ambiente' => 2, 'estab' => '002', 'pto_emi' => '001', 'secuencial_actual' => 0],
        ], 200),
    ]);

    $this->actingAs($owner)
        ->withHeader('X-Tenant', $tenant->slug)
        ->putJson('/api/v1/settings/billing-emission', $payload)
        ->assertOk()
        ->assertJsonPath('data.ambiente', 2)
        ->assertJsonPath('data.estab', '002')
        ->assertJsonPath('data.secuencial_actual', 0);

    Http::assertSent(function ($request) use ($tenant, $payload) {
        return $request->method() === 'PUT'
            && str_contains($request->url(), "/api/tenant-billing-configs/{$tenant->id}/emission")
            && $request['ambiente'] === $payload['ambiente']
            && $request['estab'] === $payload['estab']
            && $request['pto_emi'] === $payload['pto_emi']
            && $request['nombre'] === $payload['nombre']
            && $request['dir_establecimiento'] === $payload['dir_establecimiento'];
    });
});

test('PUT billing-emission surfaces the billing service error as a 422', function () use ($payload) {
    $tenant = emissionTenant();
    $owner = emissionOwner($tenant);

    Http::fake([
        '*/api/tenant-billing-configs/*/emission' => Http::response(
            ['message' => 'No billing config for tenant'],
            404
        ),
    ]);

    $this->actingAs($owner)
        ->withHeader('X-Tenant', $tenant->slug)
        ->putJson('/api/v1/settings/billing-emission', $payload)
        ->assertStatus(422)
        ->assertJsonPath('message', 'No billing config for tenant');
});

test('PUT billing-emission validates the establecimiento before calling billing', function () {
    $tenant = emissionTenant();
    $owner = emissionOwner($tenant);

    Http::fake();

    $this->actingAs($owner)
        ->withHeader('X-Tenant', $tenant->slug)
        ->putJson('/api/v1/settings/billing-emission', [
            'ambiente'            => 3,
            'estab'               => '1',
            'pto_emi'             => '001',
            'nombre'              => 'Sucursal',
            'dir_establecimiento' => 'Av. Siempre Viva',
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['ambiente', 'estab']);

    Http::assertNothingSent();
});

test('PUT billing-emission stays behind the tenant member guard', function () use ($payload) {
    $tenant = emissionTenant();
    $outsider = UserModel::factory()->create();

    Http::fake();

    $this->actingAs($outsider)
        ->withHeader('X-Tenant', $tenant->slug)
        ->putJson('/api/v1/settings/billing-emission', $payload)
        ->assertForbidden();

    Http::assertNothingSent();
});
