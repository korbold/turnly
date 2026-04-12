<?php

use App\Infrastructure\Persistence\Models\TenantModel;

test('can register a new tenant', function () {
    $response = $this->postJson('/api/v1/onboarding/register', [
        'name' => 'My Car Wash',
        'slug' => 'my-car-wash',
        'owner_name' => 'John Doe',
        'email' => 'john@mycarwash.com',
        'password' => 'secret1234',
        'phone' => '+54 11 1234-5678',
        'city' => 'Buenos Aires',
        'country' => 'AR',
    ]);

    $response->assertStatus(201)
        ->assertJsonStructure([
            'data' => [
                'tenant' => ['id', 'slug', 'name'],
                'token',
            ],
        ]);

    $this->assertDatabaseHas('tenants', [
        'slug' => 'my-car-wash',
        'email' => 'john@mycarwash.com',
    ]);
});

test('slug must be unique for tenant registration', function () {
    TenantModel::factory()->create(['slug' => 'existing-wash']);

    $response = $this->postJson('/api/v1/onboarding/register', [
        'name' => 'Another Wash',
        'slug' => 'existing-wash',
        'owner_name' => 'Jane Doe',
        'email' => 'jane@anotherwash.com',
        'password' => 'secret1234',
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['slug']);
});

test('email must be unique for tenant registration', function () {
    TenantModel::factory()->create(['email' => 'taken@wash.com']);

    $response = $this->postJson('/api/v1/onboarding/register', [
        'name' => 'New Wash',
        'slug' => 'new-wash',
        'owner_name' => 'Bob',
        'email' => 'taken@wash.com',
        'password' => 'secret1234',
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['email']);
});

test('slug must match valid format', function () {
    $response = $this->postJson('/api/v1/onboarding/register', [
        'name' => 'My Car Wash',
        'slug' => 'Invalid Slug!',
        'owner_name' => 'Test User',
        'email' => 'test@test.com',
        'password' => 'secret1234',
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['slug']);
});

test('can check if slug is available', function () {
    $response = $this->getJson('/api/v1/onboarding/check-slug?slug=brand-new-slug');

    $response->assertOk()
        ->assertJsonPath('data.available', true);
});

test('check slug returns unavailable when taken', function () {
    TenantModel::factory()->create(['slug' => 'taken-slug']);

    $response = $this->getJson('/api/v1/onboarding/check-slug?slug=taken-slug');

    $response->assertOk()
        ->assertJsonPath('data.available', false);
});

test('tenant registration requires required fields', function () {
    $response = $this->postJson('/api/v1/onboarding/register', []);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['name', 'slug', 'owner_name', 'email', 'password']);
});
