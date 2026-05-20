<?php

use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('authenticated user can accept terms', function () {
    $user = UserModel::factory()->create([
        'email_verified_at' => now(),
        'terms_accepted_at' => null,
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->postJson('/api/v1/auth/accept-terms', ['version' => '1.0']);

    $response->assertOk()
        ->assertJsonPath('data.terms_version_accepted', '1.0');

    expect($user->fresh()->terms_accepted_at)->not->toBeNull();
    expect($user->fresh()->terms_version_accepted)->toBe('1.0');
});

test('accept-terms requires authentication', function () {
    $this->postJson('/api/v1/auth/accept-terms', ['version' => '1.0'])
        ->assertUnauthorized();
});

test('accept-terms requires version field', function () {
    $user = UserModel::factory()->create(['email_verified_at' => now()]);

    $this->actingAs($user, 'sanctum')
        ->postJson('/api/v1/auth/accept-terms', [])
        ->assertUnprocessable();
});
