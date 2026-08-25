<?php
// apps/backend/tests/Feature/ClientResource/AssignOwnerTest.php
//
// Ponerle dueño a un vehículo que ya existe.
//
// En producción hay 277 vehículos sin dueño y 3 con dueño. El picker une los
// autos cuando se crea uno nuevo, pero los que ya estaban no pasan por ahí:
// los dos autos de Gaby quedaron sueltos y no había forma de juntarlos desde
// ninguna pantalla.

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    $this->member = function (string $role, string $name) {
        $user = UserModel::factory()->create(['name' => $name]);
        TenantUserModel::create([
            'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
            'user_id' => $user->id, 'role' => $role, 'is_active' => true,
        ]);
        return $user;
    };

    $this->cajera = ($this->member)('cashier', 'Vanessa');
    $this->gaby   = ($this->member)('client', 'Gaby Arellano');
    $this->otro   = ($this->member)('client', 'Pedro Suárez');

    $this->as = fn (UserModel $u) => $this->actingAs($u)
        ->withHeader('X-Tenant', $this->tenant->slug);

    $this->auto = fn (string $placa, ?UserModel $dueno = null) => ClientResourceModel::create([
        'id'        => (string) Str::uuid(),
        'tenant_id' => $this->tenant->id,
        'client_id' => $dueno?->id,
        'type'      => 'suv',
        'data'      => ['plate' => $placa, 'nombre' => 'Gaby Arellano'],
    ]);
});

test('an unowned vehicle can be given an owner', function () {
    $auto = ($this->auto)('IBE3469');

    ($this->as)($this->cajera)
        ->patchJson("/api/v1/client-resources/{$auto->id}", [
            'data'      => $auto->data,
            'client_id' => $this->gaby->id,
        ])
        ->assertOk();

    expect($auto->fresh()->client_id)->toBe($this->gaby->id);
});

test('both of the persons vehicles end up under the same owner', function () {
    // El caso que lo pidió: dos autos sueltos que son de la misma persona.
    $uno = ($this->auto)('IBE3469');
    $dos = ($this->auto)('PCC7286');

    foreach ([$uno, $dos] as $auto) {
        ($this->as)($this->cajera)
            ->patchJson("/api/v1/client-resources/{$auto->id}", [
                'data'      => $auto->data,
                'client_id' => $this->gaby->id,
            ])
            ->assertOk();
    }

    expect($uno->fresh()->client_id)->toBe($this->gaby->id);
    expect($dos->fresh()->client_id)->toBe($this->gaby->id);
});

test('an owner assigned by mistake can be corrected', function () {
    // Sin esto, equivocarse de persona deja el auto trabado con el dueño
    // equivocado para siempre — y equivocarse buscando por nombre es fácil.
    $auto = ($this->auto)('IBE3469', $this->otro);

    ($this->as)($this->cajera)
        ->patchJson("/api/v1/client-resources/{$auto->id}", [
            'data'      => $auto->data,
            'client_id' => $this->gaby->id,
        ])
        ->assertOk();

    expect($auto->fresh()->client_id)->toBe($this->gaby->id);
});

test('editing the data alone does not touch the owner', function () {
    // Corregir el color no puede cambiar de dueño el auto: el traspaso es una
    // acción deliberada, no un efecto de guardar el formulario.
    $auto = ($this->auto)('IBE3469', $this->gaby);

    ($this->as)($this->cajera)
        ->patchJson("/api/v1/client-resources/{$auto->id}", [
            'data' => ['plate' => 'IBE3469', 'nombre' => 'Gaby Arellano', 'color' => 'Azul'],
        ])
        ->assertOk();

    expect($auto->fresh()->client_id)->toBe($this->gaby->id);
});

test('a vehicle from another tenant is a 404', function () {
    $auto = ($this->auto)('IBE3469');

    $otroTenant = TenantModel::factory()->create(['status' => 'active']);
    $ajeno = UserModel::factory()->create();
    TenantUserModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $otroTenant->id,
        'user_id' => $ajeno->id, 'role' => 'owner', 'is_active' => true,
    ]);

    $this->actingAs($ajeno)->withHeader('X-Tenant', $otroTenant->slug)
        ->patchJson("/api/v1/client-resources/{$auto->id}", [
            'data' => $auto->data, 'client_id' => $ajeno->id,
        ])
        ->assertStatus(404);
});
