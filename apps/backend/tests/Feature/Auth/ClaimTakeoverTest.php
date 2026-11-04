<?php

use App\Infrastructure\Persistence\Models\ClaimTokenModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Facades\Mail;

/**
 * El claim por QR/PIN devuelve el token en la respuesta. Hasta noviembre de
 * 2026 se podía pedir sin login (`auth/claim/start` con method=qr_pin) y desde
 * `clients/{id}/invite-app` para cualquier usuario de la plataforma: con un
 * email, teléfono o cédula alguien se quedaba con la cuenta, la del dueño
 * incluida.
 */
beforeEach(function () {
    Mail::fake();

    $this->tenant = TenantModel::factory()->create(['status' => 'active', 'slug' => 'lavadora']);
    $this->owner = UserModel::factory()->create(['email' => 'dueno@lavadora.ec', 'email_verified_at' => now()]);
    TenantUserModel::create(['tenant_id' => $this->tenant->id, 'user_id' => $this->owner->id, 'role' => 'owner', 'is_active' => true]);

    $this->ghost = UserModel::factory()->create(['email' => 'walkin@cliente.ec', 'created_by_walkin' => true]);
    TenantUserModel::create(['tenant_id' => $this->tenant->id, 'user_id' => $this->ghost->id, 'role' => 'client', 'is_active' => true]);
});

function inviteApp($test, UserModel $as, string $userId)
{
    return $test->actingAs($as, 'sanctum')
        ->withHeader('X-Tenant', 'lavadora')
        ->postJson("/api/v1/clients/{$userId}/invite-app");
}

test('public claim start refuses qr_pin and hands out no token', function () {
    $response = $this->postJson('/api/v1/auth/claim/start', [
        'identifier' => 'dueno@lavadora.ec',
        'method' => 'qr_pin',
    ]);

    $response->assertStatus(422)->assertJsonPath('error.code', 'METHOD_NOT_ALLOWED');
    expect($response->json('data.token'))->toBeNull();
    expect(ClaimTokenModel::count())->toBe(0);
});

test('public claim start still sends the magic link to the owner email', function () {
    $response = $this->postJson('/api/v1/auth/claim/start', [
        'identifier' => 'walkin@cliente.ec',
        'method' => 'magic_link',
    ]);

    $response->assertOk()->assertJsonPath('data.method', 'magic_link');
    expect($response->json('data.token'))->toBeNull();
});

test('a client of the business cannot generate a PIN for anyone', function () {
    $client = UserModel::factory()->create(['email_verified_at' => now()]);
    TenantUserModel::create(['tenant_id' => $this->tenant->id, 'user_id' => $client->id, 'role' => 'client', 'is_active' => true]);

    inviteApp($this, $client, $this->owner->id)->assertStatus(403);
    inviteApp($this, $client, $this->ghost->id)->assertStatus(403);
    expect(ClaimTokenModel::count())->toBe(0);
});

test('staff cannot generate a PIN for an account that was already claimed', function () {
    inviteApp($this, $this->owner, $this->owner->id)->assertStatus(422);
    expect(ClaimTokenModel::count())->toBe(0);
});

test('staff cannot generate a PIN for a user of another business', function () {
    $other = TenantModel::factory()->create(['status' => 'active', 'slug' => 'otro']);
    $foreignGhost = UserModel::factory()->create(['created_by_walkin' => true]);
    TenantUserModel::create(['tenant_id' => $other->id, 'user_id' => $foreignGhost->id, 'role' => 'client', 'is_active' => true]);

    inviteApp($this, $this->owner, $foreignGhost->id)->assertStatus(404);
    expect(ClaimTokenModel::count())->toBe(0);
});

test('staff generates the PIN for their own walk-in', function () {
    $response = inviteApp($this, $this->owner, $this->ghost->id);

    $response->assertOk()->assertJsonPath('data.user_id', $this->ghost->id);
    expect($response->json('data.pin'))->toHaveLength(6);
});
