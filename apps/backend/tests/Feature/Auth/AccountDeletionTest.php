<?php

use App\Infrastructure\Persistence\Models\UserModel;

test('authenticated user can request account deletion', function () {
    $user = UserModel::factory()->create();
    $token = $user->createToken('auth_token')->plainTextToken;

    $response = $this->withToken($token)
        ->deleteJson('/api/v1/auth/account');

    $response->assertOk()
        ->assertJsonPath('data.deletes_at', fn ($v) => $v !== null);

    $user->refresh();
    expect($user->deletion_requested_at)->not->toBeNull();
    expect($user->tokens()->count())->toBe(0);
});

test('unauthenticated request to delete account returns 401', function () {
    $response = $this->deleteJson('/api/v1/auth/account');
    $response->assertStatus(401);
});
