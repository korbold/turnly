<?php

use App\Infrastructure\Persistence\Models\UserModel;

test('authenticated user can register device token', function () {
    $user = UserModel::factory()->create();

    $response = $this->actingAs($user)->postJson('/api/v1/device-tokens', [
        'token' => 'fcm-test-token-123',
        'platform' => 'android',
    ]);

    $response->assertStatus(201)
        ->assertJsonPath('data.message', 'Device token registered');

    $this->assertDatabaseHas('device_tokens', [
        'user_id' => $user->id,
        'token' => 'fcm-test-token-123',
        'platform' => 'android',
        'is_active' => true,
    ]);
});

test('registering same token updates existing record', function () {
    $user = UserModel::factory()->create();

    $this->actingAs($user)->postJson('/api/v1/device-tokens', [
        'token' => 'fcm-test-token-123',
        'platform' => 'android',
    ]);

    $this->actingAs($user)->postJson('/api/v1/device-tokens', [
        'token' => 'fcm-test-token-123',
        'platform' => 'web',
    ]);

    $this->assertDatabaseCount('device_tokens', 1);
    $this->assertDatabaseHas('device_tokens', [
        'token' => 'fcm-test-token-123',
        'platform' => 'web',
    ]);
});

test('authenticated user can delete device token', function () {
    $user = UserModel::factory()->create();

    $this->actingAs($user)->postJson('/api/v1/device-tokens', [
        'token' => 'fcm-test-token-456',
        'platform' => 'android',
    ]);

    $response = $this->actingAs($user)->deleteJson('/api/v1/device-tokens/fcm-test-token-456');

    $response->assertOk();
    $this->assertDatabaseMissing('device_tokens', ['token' => 'fcm-test-token-456']);
});

test('unauthenticated user cannot register device token', function () {
    $this->postJson('/api/v1/device-tokens', [
        'token' => 'fcm-test-token-789',
        'platform' => 'android',
    ])->assertStatus(401);
});
