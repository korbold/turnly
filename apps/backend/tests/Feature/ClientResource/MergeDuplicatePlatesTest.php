<?php
// apps/backend/tests/Feature/ClientResource/MergeDuplicatePlatesTest.php
//
// La limpieza de los duplicados que quedaron antes de que el alta los
// rechazara. Toca historial y plata de producción, así que cada regla del
// comando tiene su caso acá.

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ManualDebtModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active', 'business_type' => 'car_wash']);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    $this->dueno = UserModel::factory()->create();
    $this->service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);

    $this->recurso = function (string $plate, array $extra = [], ?string $clientId = null, $creado = null) {
        $r = ClientResourceModel::create([
            'id' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'client_id' => $clientId ?? $this->dueno->id,
            'type' => 'sedan',
            'data' => array_merge(['plate' => $plate], $extra),
        ]);

        // `created_at` no es fillable, y acá la fecha es el dato que decide
        // cuál fila sobrevive: se escribe a mano.
        if ($creado) {
            $r->forceFill(['created_at' => $creado])->saveQuietly();
        }

        return $r->refresh();
    };

    $this->servicio = fn (ClientResourceModel $r, float $precio = 15) => ServiceLogModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $r->id,
        'service_id' => $this->service->id,
        'attended_by' => $this->dueno->id,
        'created_by' => $this->dueno->id,
        'price_charged' => $precio,
        'log_date' => now()->toDateString(),
    ]);
});

test('the absorbed rows are soft-deleted, not erased', function () {
    // `client_resources` usa soft delete: la fila absorbida queda marcada y
    // recuperable. Para una fusión sobre datos reales es lo que se quiere —
    // si algo salió mal, el dato sigue ahí.
    $vieja = ($this->recurso)('IBB3039', [], null, now()->subDay());
    $nueva = ($this->recurso)('IBB3039', [], null, now());

    $this->artisan('clients:merge-duplicate-plates', ['--tenant' => $this->tenant->slug]);

    expect(ClientResourceModel::count())->toBe(1);
    expect(ClientResourceModel::withoutGlobalScopes()->find($nueva->id)->deleted_at)->not->toBeNull();
});

test('the oldest row survives and the rest are absorbed', function () {
    $vieja = ($this->recurso)('IBD9115', [], null, now()->subDays(3));
    $nueva = ($this->recurso)('IBD9115', [], null, now());
    ($this->servicio)($nueva, 52);

    $this->artisan('clients:merge-duplicate-plates', ['--tenant' => $this->tenant->slug])
        ->assertSuccessful();

    expect(ClientResourceModel::count())->toBe(1);
    expect(ClientResourceModel::first()->id)->toBe($vieja->id);
    // El servicio no se pierde: pasa a colgar del que quedó.
    expect(ServiceLogModel::withoutGlobalScopes()->first()->client_resource_id)->toBe($vieja->id);
});

test('nothing is lost when both copies have history', function () {
    // El caso delicado: dos filas usadas. La plata del vehículo tiene que
    // quedar igual, sólo que junta.
    $a = ($this->recurso)('POB581', [], null, now()->subDays(5));
    $b = ($this->recurso)('POB581', [], null, now()->subDay());
    ($this->servicio)($a, 12);
    ($this->servicio)($b, 32);

    $this->artisan('clients:merge-duplicate-plates', ['--tenant' => $this->tenant->slug]);

    $quedan = ServiceLogModel::withoutGlobalScopes()->get();
    expect($quedan)->toHaveCount(2);
    expect($quedan->pluck('client_resource_id')->unique()->all())->toBe([$a->id]);
    expect((float) $quedan->sum('price_charged'))->toBe(44.0);
});

test('the surviving row picks up the fields the other one had', function () {
    // Una copia tiene la marca y la otra no: al borrarla no puede perderse.
    $vieja = ($this->recurso)('IBF3667', ['color' => 'Verde'], null, now()->subDay());
    ($this->recurso)('IBF3667', ['brand' => 'Luv', 'color' => 'Gris'], null, now());

    $this->artisan('clients:merge-duplicate-plates', ['--tenant' => $this->tenant->slug]);

    $data = ClientResourceModel::withoutGlobalScopes()->find($vieja->id)->data;
    expect($data['brand'])->toBe('Luv');
    // Lo que ya tenía no se pisa: el color de la sobreviviente manda.
    expect($data['color'])->toBe('Verde');
});

test('the plate is matched however it was typed', function () {
    $vieja = ($this->recurso)('IBD-9115', [], null, now()->subDay());
    ($this->recurso)('ibd 9115', [], null, now());

    $this->artisan('clients:merge-duplicate-plates', ['--tenant' => $this->tenant->slug]);

    expect(ClientResourceModel::count())->toBe(1);
    expect(ClientResourceModel::first()->id)->toBe($vieja->id);
});

test('placeholder plates are left alone', function () {
    // Nueve motos comparten "000" en producción y no son el mismo vehículo.
    ($this->recurso)('000');
    ($this->recurso)('000');
    ($this->recurso)('0000');

    $this->artisan('clients:merge-duplicate-plates', ['--tenant' => $this->tenant->slug]);

    expect(ClientResourceModel::count())->toBe(3);
});

test('two different owners are not a duplicate', function () {
    // Misma placa y dueños distintos es una transferencia mal hecha, no una
    // copia: lo decide una persona mirando el caso, no un comando.
    $otro = UserModel::factory()->create();
    ($this->recurso)('PVZ0583', [], null, now()->subDay());
    ($this->recurso)('PVZ0583', [], $otro->id, now());

    $this->artisan('clients:merge-duplicate-plates', ['--tenant' => $this->tenant->slug]);

    expect(ClientResourceModel::count())->toBe(2);
});

test('an unowned copy is still a duplicate, and the owner is adopted', function () {
    // Pasa en producción: el alta no pudo deducir el nombre y dejó el
    // vehículo sin dueño, y la segunda copia quedó colgada de la cajera. Un
    // `client_id` nulo es información que falta, no un dueño en conflicto.
    $vieja = ($this->recurso)('POB581', [], null, now()->subDays(6));
    $vieja->forceFill(['client_id' => null])->saveQuietly();
    ($this->recurso)('POB581', [], $this->dueno->id, now());

    $this->artisan('clients:merge-duplicate-plates', ['--tenant' => $this->tenant->slug]);

    expect(ClientResourceModel::count())->toBe(1);
    $queda = ClientResourceModel::first();
    expect($queda->id)->toBe($vieja->id);
    expect($queda->client_id)->toBe($this->dueno->id);
});

test('the dry run changes nothing', function () {
    $vieja = ($this->recurso)('IBA8563', [], null, now()->subDay());
    $nueva = ($this->recurso)('IBA8563', [], null, now());
    ($this->servicio)($nueva);

    $this->artisan('clients:merge-duplicate-plates', [
        '--tenant' => $this->tenant->slug,
        '--dry-run' => true,
    ])->assertSuccessful();

    expect(ClientResourceModel::count())->toBe(2);
    expect(ServiceLogModel::withoutGlobalScopes()->first()->client_resource_id)->toBe($nueva->id);
});

test('manual debts move with the rest', function () {
    $vieja = ($this->recurso)('IBC1041', [], null, now()->subDay());
    $nueva = ($this->recurso)('IBC1041', [], null, now());

    ManualDebtModel::create([
        'id' => (string) Str::uuid(),
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $nueva->id,
        'amount' => 80,
        'reason' => 'Lavada fiada',
        'incurred_on' => now()->toDateString(),
        'created_by' => $this->dueno->id,
    ]);

    $this->artisan('clients:merge-duplicate-plates', ['--tenant' => $this->tenant->slug]);

    expect(ManualDebtModel::withoutGlobalScopes()->first()->client_resource_id)->toBe($vieja->id);
});

test('a tenant is not touched by another tenant is cleanup', function () {
    $otro = TenantModel::factory()->create(['status' => 'active']);
    ClientResourceModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $otro->id,
        'client_id' => $this->dueno->id, 'type' => 'sedan',
        'data' => ['plate' => 'ZZZ1111'],
    ]);
    ClientResourceModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $otro->id,
        'client_id' => $this->dueno->id, 'type' => 'sedan',
        'data' => ['plate' => 'ZZZ1111'],
    ]);

    $this->artisan('clients:merge-duplicate-plates', ['--tenant' => $this->tenant->slug]);

    expect(ClientResourceModel::withoutGlobalScopes()->whereNull('deleted_at')->where('tenant_id', $otro->id)->count())->toBe(2);
});
