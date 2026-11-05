<?php

use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;

/**
 * Cualquiera se vuelve `client` de un negocio con reservar una vez en su
 * página pública, y `tenant.member` lo dejaba pasar como si fuera personal:
 * veía reservas y datos fiscales de los demás clientes, subía su propio
 * certificado del SRI, y con `users/*` —que no miraba el rol de nadie— se
 * subía a admin o le cambiaba la contraseña al dueño. Como la contraseña es
 * de toda la plataforma, el dueño de otro negocio podía vincular a cualquier
 * usuario como cliente suyo y cambiársela.
 */
beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active', 'slug' => 'lavadora']);

    $this->owner = scopeMember($this->tenant, 'owner');
    $this->admin = scopeMember($this->tenant, 'tenant_admin');
    $this->cashier = scopeMember($this->tenant, 'cashier');
    $this->client = scopeMember($this->tenant, 'client');
});

function scopeMember(TenantModel $tenant, string $role, ?UserModel $user = null): UserModel
{
    $user ??= UserModel::factory()->create(['email_verified_at' => now()]);
    TenantUserModel::create(['tenant_id' => $tenant->id, 'user_id' => $user->id, 'role' => $role, 'is_active' => true]);

    return $user;
}

function scopeRole(TenantModel $tenant, UserModel $user): ?string
{
    return TenantUserModel::where('tenant_id', $tenant->id)->where('user_id', $user->id)->value('role');
}

function asMember($test, UserModel $user, string $slug = 'lavadora')
{
    return $test->actingAs($user, 'sanctum')->withHeader('X-Tenant', $slug);
}

// --- C3: un cliente no es personal del negocio -------------------------------

test('a client of the business is not staff: the inside routes refuse it', function (string $uri) {
    asMember($this, $this->client)->getJson($uri)
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'TENANT_FORBIDDEN');
})->with([
    '/api/v1/reservations',
    '/api/v1/users',
    '/api/v1/tenant/billing-profile',
    '/api/v1/service-logs',
    '/api/v1/clients/search?q=gmail',
]);

test('a client cannot upload its own SRI certificate to the business', function () {
    asMember($this, $this->client)
        ->post('/api/v1/settings/billing-cert', [
            'certificate' => UploadedFile::fake()->create('firma.p12', 4),
            'password' => 'x',
        ], ['Accept' => 'application/json'])
        ->assertStatus(403);
});

test('the client keeps its own side: its reservations and vehicles', function () {
    asMember($this, $this->client)->getJson('/api/v1/client/reservations')->assertOk();
    asMember($this, $this->client)->getJson('/api/v1/client-resources')->assertOk();
});

test('staff keeps working the floor', function () {
    asMember($this, $this->cashier)->getJson('/api/v1/service-logs')->assertOk();
    asMember($this, $this->cashier)->getJson('/api/v1/reservations')->assertOk();
});

// --- C2: roles y contraseñas, solo el dueño o el admin -----------------------

test('a cashier cannot promote itself to admin', function () {
    asMember($this, $this->cashier)
        ->patchJson("/api/v1/users/{$this->cashier->id}/role", ['role' => 'tenant_admin'])
        ->assertStatus(403);

    expect(scopeRole($this->tenant, $this->cashier))->toBe('cashier');
});

test('a cashier cannot change the owner password', function () {
    asMember($this, $this->cashier)
        ->patchJson("/api/v1/users/{$this->owner->id}/password", ['password' => 'robada123'])
        ->assertStatus(403);

    expect(Hash::check('robada123', $this->owner->fresh()->password))->toBeFalse();
});

test('a cashier cannot touch the business billing setup', function () {
    asMember($this, $this->cashier)->getJson('/api/v1/settings/billing-cert')->assertStatus(403);
    asMember($this, $this->cashier)->patchJson('/api/v1/tenant/billing-profile', ['ruc' => '1790000000001'])->assertStatus(403);
    asMember($this, $this->cashier)->putJson('/api/v1/settings/billing-emission', ['ambiente' => 2])->assertStatus(403);
});

test('nobody changes the owner role, an admin included', function () {
    asMember($this, $this->admin)
        ->patchJson("/api/v1/users/{$this->owner->id}/role", ['role' => 'client'])
        ->assertStatus(403);

    expect(scopeRole($this->tenant, $this->owner))->toBe('owner');
});

test('an admin cannot change its own role', function () {
    asMember($this, $this->admin)
        ->patchJson("/api/v1/users/{$this->admin->id}/role", ['role' => 'cashier'])
        ->assertStatus(403);

    expect(scopeRole($this->tenant, $this->admin))->toBe('tenant_admin');
});

test('the admin still manages the team', function () {
    asMember($this, $this->admin)
        ->patchJson("/api/v1/users/{$this->cashier->id}/role", ['role' => 'washer'])
        ->assertOk();
    expect(scopeRole($this->tenant, $this->cashier))->toBe('washer');

    asMember($this, $this->owner)
        ->patchJson("/api/v1/users/{$this->cashier->id}/password", ['password' => 'nueva1234'])
        ->assertOk();
    expect(Hash::check('nueva1234', $this->cashier->fresh()->password))->toBeTrue();
});

test('the owner of another business cannot hijack a user by linking it as a client', function () {
    $other = TenantModel::factory()->create(['status' => 'active', 'slug' => 'otro']);
    $attacker = scopeMember($other, 'owner');

    // Lo vincula como cliente de su negocio, lo sube a cajero y le cambia la
    // contraseña: la de toda la plataforma, la que usa en `lavadora`.
    asMember($this, $attacker, 'otro')->postJson("/api/v1/clients/{$this->owner->id}/link-to-tenant")->assertOk();
    asMember($this, $attacker, 'otro')
        ->patchJson("/api/v1/users/{$this->owner->id}/role", ['role' => 'cashier'])
        ->assertOk();

    asMember($this, $attacker, 'otro')
        ->patchJson("/api/v1/users/{$this->owner->id}/password", ['password' => 'robada123'])
        ->assertStatus(403);

    expect(Hash::check('robada123', $this->owner->fresh()->password))->toBeFalse();
});

test('a user outside the business is not shown by id', function () {
    $stranger = UserModel::factory()->create();

    asMember($this, $this->admin)->getJson("/api/v1/users/{$stranger->id}")->assertStatus(404);
    asMember($this, $this->admin)->getJson("/api/v1/users/{$this->cashier->id}")->assertOk();
});
