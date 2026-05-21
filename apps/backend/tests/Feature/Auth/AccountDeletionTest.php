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

test('magic link login auto-restores account pending deletion', function () {
    $user = UserModel::factory()->create([
        'email' => 'restore@example.com',
        'deletion_requested_at' => now()->subDays(5),
        'email_verified_at' => now(),
    ]);

    $token = bin2hex(random_bytes(32));
    $tokenHash = hash('sha256', $token);
    \Illuminate\Support\Facades\DB::table('magic_link_tokens')->insert([
        'email' => 'restore@example.com',
        'token_hash' => $tokenHash,
        'expires_at' => now()->addMinutes(15),
        'request_ip' => '127.0.0.1',
        'request_user_agent' => 'test',
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $response = $this->postJson('/api/v1/auth/magic-link/verify', ['token' => $token]);

    $response->assertOk()
        ->assertJsonPath('data.account_restored', true);

    $user->refresh();
    expect($user->deletion_requested_at)->toBeNull();
});

test('magic link login with no pending deletion has account_restored false', function () {
    $user = UserModel::factory()->create([
        'email' => 'normal@example.com',
        'email_verified_at' => now(),
    ]);

    $token = bin2hex(random_bytes(32));
    $tokenHash = hash('sha256', $token);
    \Illuminate\Support\Facades\DB::table('magic_link_tokens')->insert([
        'email' => 'normal@example.com',
        'token_hash' => $tokenHash,
        'expires_at' => now()->addMinutes(15),
        'request_ip' => '127.0.0.1',
        'request_user_agent' => 'test',
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $response = $this->postJson('/api/v1/auth/magic-link/verify', ['token' => $token]);

    $response->assertOk()
        ->assertJsonPath('data.account_restored', false);
});

test('purge command deletes users with deletion_requested_at older than 30 days', function () {
    $old = UserModel::factory()->create([
        'deletion_requested_at' => now()->subDays(31),
    ]);
    $recent = UserModel::factory()->create([
        'deletion_requested_at' => now()->subDays(5),
    ]);
    $normal = UserModel::factory()->create([
        'deletion_requested_at' => null,
    ]);

    $this->artisan('accounts:purge-deletions')->assertSuccessful();

    expect(UserModel::find($old->id))->toBeNull();
    expect(UserModel::find($recent->id))->not->toBeNull();
    expect(UserModel::find($normal->id))->not->toBeNull();
});
