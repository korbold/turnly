<?php

use App\Domain\Identity\ClaimService;
use App\Infrastructure\Persistence\Models\ClaimTokenModel;
use App\Infrastructure\Persistence\Models\UserBillingProfileModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Facades\Mail;

beforeEach(function () {
    Mail::fake();
});

test('lookup returns exists=false when no user matches', function () {
    $response = $this->postJson('/api/v1/auth/lookup', [
        'identifier' => 'noone@example.com',
    ]);
    $response->assertOk()->assertJsonPath('data.exists', false);
});

test('lookup detects a ghost user and masks contact info', function () {
    $user = UserModel::factory()->create([
        'email' => 'ghost@example.com',
        'phone' => '+593997777777',
        'created_by_walkin' => true,
    ]);

    $response = $this->postJson('/api/v1/auth/lookup', [
        'identifier' => 'ghost@example.com',
    ]);

    $response->assertOk()
        ->assertJsonPath('data.exists', true)
        ->assertJsonPath('data.is_ghost', true)
        ->assertJsonPath('data.recommended_method', 'magic_link');

    expect($response->json('data.masked_email'))->toContain('***');
});

test('claim verify by PIN flips claimed_at and issues a sanctum token', function () {
    $user = UserModel::factory()->create([
        'email' => 'pin@example.com',
        'phone' => '+593996666666',
        'created_by_walkin' => true,
    ]);

    $service = app(ClaimService::class);
    $info = $service->startQrPin($user);

    $response = $this->postJson('/api/v1/auth/claim/verify', [
        'pin' => $info['pin'],
    ]);

    $response->assertOk();
    $token = $response->json('data.token');
    expect($token)->not->toBeEmpty();

    $fresh = $user->fresh();
    expect($fresh->claimed_at)->not->toBeNull();
});

test('expired PIN is rejected', function () {
    $user = UserModel::factory()->create(['created_by_walkin' => true]);
    $service = app(ClaimService::class);
    $info = $service->startQrPin($user);

    // Force expiry
    ClaimTokenModel::where('pin', $info['pin'])->update(['expires_at' => now()->subMinute()]);

    $response = $this->postJson('/api/v1/auth/claim/verify', [
        'pin' => $info['pin'],
    ]);

    $response->assertStatus(401);
});

test('used PIN cannot be redeemed twice', function () {
    $user = UserModel::factory()->create(['created_by_walkin' => true]);
    $service = app(ClaimService::class);
    $info = $service->startQrPin($user);

    $first = $this->postJson('/api/v1/auth/claim/verify', ['pin' => $info['pin']]);
    $first->assertOk();

    $second = $this->postJson('/api/v1/auth/claim/verify', ['pin' => $info['pin']]);
    $second->assertStatus(401);
});

test('lookup finds user by billing doc_number', function () {
    $user = UserModel::factory()->create(['email' => 'doc@example.com']);
    UserBillingProfileModel::create([
        'user_id'    => $user->id,
        'doc_type'   => 'cedula',
        'doc_number' => '1712345678',
        'legal_name' => 'Test',
        'email'      => 'doc@example.com',
        'is_default' => true,
    ]);

    $response = $this->postJson('/api/v1/auth/lookup', [
        'identifier' => '1712345678',
    ]);

    $response->assertOk()->assertJsonPath('data.exists', true);
});
