<?php

use App\Infrastructure\Mail\PasswordResetMail;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

function pwResetOwner(string $email): UserModel
{
    $tenant = TenantModel::factory()->create(['status' => 'active']);
    $user = UserModel::factory()->create(['email' => $email]);
    TenantUserModel::create([
        'id'        => (string) Str::uuid(),
        'tenant_id' => $tenant->id,
        'user_id'   => $user->id,
        'role'      => 'owner',
        'is_active' => true,
    ]);
    return $user;
}

test('forgot password emails a reset link for a registered business email', function () {
    Mail::fake();
    pwResetOwner('dueno@negocio.com');

    $this->postJson('/api/v1/auth/password/forgot', ['email' => 'dueno@negocio.com'])
        ->assertOk()
        ->assertJsonPath('data.sent', true);

    expect(DB::table('password_reset_tokens')->where('email', 'dueno@negocio.com')->exists())->toBeTrue();
    Mail::assertQueued(PasswordResetMail::class);
});

test('forgot password returns BUSINESS_NOT_FOUND for an unregistered email', function () {
    Mail::fake();

    $this->postJson('/api/v1/auth/password/forgot', ['email' => 'nadie@ninguna.com'])
        ->assertStatus(404)
        ->assertJsonPath('error.code', 'BUSINESS_NOT_FOUND');

    expect(DB::table('password_reset_tokens')->where('email', 'nadie@ninguna.com')->exists())->toBeFalse();
    Mail::assertNothingQueued();
});

test('forgot password rejects an email with no active tenant membership', function () {
    Mail::fake();
    UserModel::factory()->create(['email' => 'suelto@x.com']); // user, no tenant_users row

    $this->postJson('/api/v1/auth/password/forgot', ['email' => 'suelto@x.com'])
        ->assertStatus(404)
        ->assertJsonPath('error.code', 'BUSINESS_NOT_FOUND');
});

test('reset password sets the new password and revokes sessions with a valid token', function () {
    $user = pwResetOwner('reset@x.com');
    $raw = str_repeat('b', 64);
    DB::table('password_reset_tokens')->insert([
        'email' => 'reset@x.com', 'token' => hash('sha256', $raw), 'created_at' => now(),
    ]);
    $user->createToken('old'); // an existing session that must be revoked

    $this->postJson('/api/v1/auth/password/reset', [
        'email' => 'reset@x.com', 'token' => $raw, 'password' => 'nuevaClave1',
    ])->assertOk()->assertJsonPath('data.message', 'Contraseña actualizada.');

    expect(Hash::check('nuevaClave1', $user->fresh()->password))->toBeTrue();
    expect(DB::table('password_reset_tokens')->where('email', 'reset@x.com')->exists())->toBeFalse();
    expect($user->fresh()->tokens()->count())->toBe(0);
});

test('reset password rejects an expired (over 60 min) token', function () {
    $user = pwResetOwner('exp@x.com');
    $raw = str_repeat('c', 64);
    DB::table('password_reset_tokens')->insert([
        'email' => 'exp@x.com', 'token' => hash('sha256', $raw), 'created_at' => now()->subMinutes(61),
    ]);

    $this->postJson('/api/v1/auth/password/reset', [
        'email' => 'exp@x.com', 'token' => $raw, 'password' => 'otra12345',
    ])->assertStatus(422)->assertJsonPath('error.code', 'INVALID_RESET_TOKEN');

    expect(Hash::check('otra12345', $user->fresh()->password))->toBeFalse();
});

test('reset password rejects a wrong token', function () {
    pwResetOwner('wrong@x.com');
    DB::table('password_reset_tokens')->insert([
        'email' => 'wrong@x.com', 'token' => hash('sha256', str_repeat('d', 64)), 'created_at' => now(),
    ]);

    $this->postJson('/api/v1/auth/password/reset', [
        'email' => 'wrong@x.com', 'token' => str_repeat('e', 64), 'password' => 'otra12345',
    ])->assertStatus(422)->assertJsonPath('error.code', 'INVALID_RESET_TOKEN');
});

test('full flow: forgot then reset with the emailed token', function () {
    Mail::fake();
    $user = pwResetOwner('flow@x.com');

    $this->postJson('/api/v1/auth/password/forgot', ['email' => 'flow@x.com'])->assertOk();

    $captured = null;
    Mail::assertQueued(PasswordResetMail::class, function ($mail) use (&$captured) {
        $captured = $mail;
        return true;
    });
    parse_str((string) parse_url($captured->resetUrl, PHP_URL_QUERY), $q);
    $rawToken = $q['token'] ?? '';

    $this->postJson('/api/v1/auth/password/reset', [
        'email' => 'flow@x.com', 'token' => $rawToken, 'password' => 'flowClave9',
    ])->assertOk();

    expect(Hash::check('flowClave9', $user->fresh()->password))->toBeTrue();
});
