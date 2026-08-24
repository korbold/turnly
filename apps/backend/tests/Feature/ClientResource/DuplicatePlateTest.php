<?php
// apps/backend/tests/Feature/ClientResource/DuplicatePlateTest.php
//
// La placa no puede entrar dos veces. El chequeo existía —el formulario
// consulta `client-resources/lookup`— pero buscaba en la columna `plate`, que
// nadie llena: en producción está NULL en las 268 filas, así que siempre
// contestaba "no existe" y el mismo auto se creaba de nuevo. Resultado:
// IBD9115 cuatro veces, con su historial y su deuda partidos.
//
// La placa real vive dentro de `data`, que son campos personalizados por
// tenant. Ahí hay que buscarla.

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active', 'business_type' => 'car_wash']);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    $this->cashier = UserModel::factory()->create();
    TenantUserModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
        'user_id' => $this->cashier->id, 'role' => 'cashier', 'is_active' => true,
    ]);

    $this->as = fn () => $this->actingAs($this->cashier)->withHeader('X-Tenant', $this->tenant->slug);

    $this->existente = fn (string $plate, string $nombre = 'Gaby Arellano') => ClientResourceModel::create([
        'id' => (string) Str::uuid(),
        'tenant_id' => $this->tenant->id,
        'client_id' => $this->cashier->id,
        'type' => 'sedan',
        'data' => ['plate' => $plate, 'nombre' => $nombre, 'brand' => 'Glory'],
    ]);

    $this->crear = fn (array $data) => ($this->as)()
        ->postJson('/api/v1/client-resources', ['type' => 'sedan', 'data' => $data]);
});

test('registering a plate that already exists is refused', function () {
    $ya = ($this->existente)('IBD9115');

    ($this->crear)(['plate' => 'IBD9115', 'nombre' => 'Otro Dueño'])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'DUPLICATE_PLATE');

    expect(ClientResourceModel::withoutGlobalScopes()->count())->toBe(1);
    expect(ClientResourceModel::withoutGlobalScopes()->first()->id)->toBe($ya->id);
});

test('the refusal says which vehicle it is and whose', function () {
    // Sin esto el cajero recibe un "no se puede" y no sabe qué hacer. Con
    // esto puede elegir el que ya existe, que es lo que quería.
    ($this->existente)('IBD9115', 'Gaby Arellano');

    $r = ($this->crear)(['plate' => 'IBD9115'])->assertStatus(422);

    expect($r->json('error.existing.id'))->not->toBeNull();
    expect($r->json('error.existing.label'))->toContain('IBD9115');
    expect($r->json('error.existing.client_name'))->toBe('Gaby Arellano');
});

test('the plate is matched however it was typed', function () {
    // El cajero escribe rápido: minúsculas, un guion, un espacio de más.
    ($this->existente)('IBD9115');

    foreach (['ibd9115', 'IBD-9115', ' IBD 9115 '] as $variante) {
        ($this->crear)(['plate' => $variante])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'DUPLICATE_PLATE');
    }

    expect(ClientResourceModel::withoutGlobalScopes()->count())->toBe(1);
});

test('placeholder plates can repeat', function () {
    // Las motos sin placa se cargan como "000". Son nueve en producción y no
    // son el mismo vehículo: bloquearlas trabaría el mostrador.
    ($this->existente)('000');

    ($this->crear)(['plate' => '000', 'nombre' => 'Otra moto'])->assertStatus(201);
    ($this->crear)(['plate' => '0000', 'nombre' => 'Otra más'])->assertStatus(201);

    expect(ClientResourceModel::withoutGlobalScopes()->count())->toBe(3);
});

test('a different plate goes through', function () {
    ($this->existente)('IBD9115');

    ($this->crear)(['plate' => 'PBT2759', 'nombre' => 'Pablo'])->assertStatus(201);

    expect(ClientResourceModel::withoutGlobalScopes()->count())->toBe(2);
});

test('another tenant may use the same plate', function () {
    ($this->existente)('IBD9115');

    $otro = TenantModel::factory()->create(['status' => 'active']);
    $user = UserModel::factory()->create();
    TenantUserModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $otro->id,
        'user_id' => $user->id, 'role' => 'cashier', 'is_active' => true,
    ]);
    app()->instance('current_tenant', $otro);
    app()->instance('current_tenant_id', $otro->id);

    $this->actingAs($user)
        ->withHeader('X-Tenant', $otro->slug)
        ->postJson('/api/v1/client-resources', ['type' => 'sedan', 'data' => ['plate' => 'IBD9115']])
        ->assertStatus(201);
});

test('the lookup finds a plate that lives inside data', function () {
    // Es el chequeo que el formulario ya hacía y que nunca encontraba nada.
    $ya = ($this->existente)('IBD9115', 'Gaby Arellano');

    $r = ($this->as)()
        ->getJson('/api/v1/client-resources/lookup?plate=ibd-9115')
        ->assertOk();

    expect($r->json('data.id'))->toBe($ya->id);
});
