<?php

use App\Domain\ServiceLog\ServiceStaffing;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ProductModel;
use App\Infrastructure\Persistence\Models\ServiceLogItemModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\ServiceStaffModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

function completeGateSetup(string $businessType): array
{
    $tenant = TenantModel::factory()->create([
        'status' => 'active', 'business_type' => $businessType,
    ]);
    app()->instance('current_tenant', $tenant);
    app()->instance('current_tenant_id', $tenant->id);

    $owner = UserModel::factory()->create();
    TenantUserModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $tenant->id,
        'user_id' => $owner->id, 'role' => 'owner', 'is_active' => true,
    ]);

    $service = ServiceModel::factory()->create(['tenant_id' => $tenant->id]);
    $resource = ClientResourceModel::factory()->create([
        'tenant_id' => $tenant->id, 'client_id' => $owner->id, 'type' => 'sedan',
    ]);

    return [$tenant, $owner, $service, $resource];
}

beforeEach(function () {
    [$this->tenant, $this->owner, $this->service, $this->resource] = completeGateSetup('car_wash');

    $this->washer = ServiceStaffModel::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Federman', 'position' => 'washer',
    ]);
    $this->dryer = ServiceStaffModel::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Luis', 'position' => 'dryer',
    ]);

    $this->log = fn (array $attrs = []) => ServiceLogModel::factory()->create(array_merge([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $this->resource->id,
        'service_id' => $this->service->id,
        'attended_by' => $this->owner->id,
        'created_by' => $this->owner->id,
        'status' => 'in_progress',
    ], $attrs));

    $this->as = fn (UserModel $user) => $this->actingAs($user)
        ->withHeader('X-Tenant', $this->tenant->slug);
});

test('completing without a washer is rejected', function () {
    $this->service->update(['staffing' => ServiceStaffing::WASHER_DRYER]);
    $log = ($this->log)(['dried_by' => $this->dryer->id]);

    ($this->as)($this->owner)
        ->patchJson("/api/v1/service-logs/{$log->id}/complete")
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'ASSIGNEES_REQUIRED');

    expect($log->fresh()->status)->toBe('in_progress');
});

test('completing a service that needs drying without a dryer is rejected', function () {
    $this->service->update(['staffing' => ServiceStaffing::WASHER_DRYER]);
    $log = ($this->log)(['washed_by' => $this->washer->id]);

    ($this->as)($this->owner)
        ->patchJson("/api/v1/service-logs/{$log->id}/complete")
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'ASSIGNEES_REQUIRED');
});

test('a wash-only service completes with just a washer', function () {
    // Una lavada de chasis no se seca. Exigir secador ahí obligaba a inventar
    // que alguien secó, que es justo el dato que este gate quiere limpio.
    $log = ($this->log)(['washed_by' => $this->washer->id]);

    ($this->as)($this->owner)
        ->patchJson("/api/v1/service-logs/{$log->id}/complete")
        ->assertOk();

    expect($log->fresh()->status)->toBe('completed');
    expect($log->fresh()->dried_by)->toBeNull();
});

test('a service that takes nobody completes with nobody assigned', function () {
    // Un cambio de aceite no lo lava ni lo seca nadie. Exigir un lavador ahí
    // era la última obligación falsa que quedaba.
    $this->service->update(['staffing' => ServiceStaffing::NONE]);
    $log = ($this->log)();

    ($this->as)($this->owner)
        ->patchJson("/api/v1/service-logs/{$log->id}/complete")
        ->assertOk();

    expect($log->fresh()->status)->toBe('completed');
    expect($log->fresh()->washed_by)->toBeNull();
});

test('the log asks for the most demanding of its lines', function () {
    // Un ticket con un cambio de aceite y una lavada completa sigue
    // necesitando los dos: manda la línea más exigente, no la primera.
    $sinNadie = ServiceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'staffing' => ServiceStaffing::NONE,
    ]);
    $secado = ServiceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'staffing' => ServiceStaffing::WASHER_DRYER,
    ]);
    $log = ($this->log)(['washed_by' => $this->washer->id, 'service_id' => null]);

    foreach ([[$sinNadie, 0], [$secado, 1]] as [$svc, $i]) {
        ServiceLogItemModel::create([
            'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
            'service_log_id' => $log->id, 'item_type' => 'service_variant',
            'ref_id' => $svc->id, 'label' => $svc->name,
            'qty' => 1, 'unit_price' => 5, 'line_total' => 5, 'sort_order' => $i,
        ]);
    }

    ($this->as)($this->owner)
        ->patchJson("/api/v1/service-logs/{$log->id}/complete")
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'ASSIGNEES_REQUIRED');
});

test('a counter sale of products alone completes with nobody assigned', function () {
    // Vender un ambientador no lo lava ni lo seca nadie. El gate viejo pedía
    // los dos porque sólo miraba el rubro del tenant.
    $log = ($this->log)(['service_id' => null]);

    $product = ProductModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
        'name' => 'Ambientador', 'price' => 2.50, 'is_active' => true,
    ]);
    ServiceLogItemModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
        'service_log_id' => $log->id, 'item_type' => 'product',
        'ref_id' => $product->id, 'label' => 'Ambientador',
        'qty' => 1, 'unit_price' => 2.50, 'line_total' => 2.50, 'sort_order' => 0,
    ]);

    ($this->as)($this->owner)
        ->patchJson("/api/v1/service-logs/{$log->id}/complete")
        ->assertOk();

    expect($log->fresh()->status)->toBe('completed');
});

test('completing with both assignees works', function () {
    $this->service->update(['staffing' => ServiceStaffing::WASHER_DRYER]);
    $log = ($this->log)([
        'washed_by' => $this->washer->id,
        'dried_by'  => $this->dryer->id,
    ]);

    ($this->as)($this->owner)
        ->patchJson("/api/v1/service-logs/{$log->id}/complete")
        ->assertOk();

    expect($log->fresh()->status)->toBe('completed');
});

test('a barbershop completes with no assignees at all', function () {
    // El gate es solo de car_wash: en los demás rubros estas columnas no se
    // usan y el endpoint tiene que comportarse igual que siempre.
    [$tenant, $owner, $service, $resource] = completeGateSetup('barbershop');

    $log = ServiceLogModel::factory()->create([
        'tenant_id' => $tenant->id,
        'client_resource_id' => $resource->id,
        'service_id' => $service->id,
        'attended_by' => $owner->id,
        'created_by' => $owner->id,
        'status' => 'in_progress',
    ]);

    $this->actingAs($owner)
        ->withHeader('X-Tenant', $tenant->slug)
        ->patchJson("/api/v1/service-logs/{$log->id}/complete")
        ->assertOk();

    expect($log->fresh()->status)->toBe('completed');
});

/*
 * El local que dejó de llevar la cuenta de quién lava y quién seca.
 *
 * La exigencia ya era por servicio —cada uno declara su `staffing`— pero
 * apagarla así obliga a editar el catálogo entero, y lo que el dueño pide es
 * dejar de usar la función. El interruptor apaga la exigencia de una vez, sin
 * tocar los servicios: si mañana la vuelve a querer, el catálogo sigue igual.
 *
 * Encendido por defecto: los locales que hoy la usan no pueden perderla por un
 * deploy.
 */
test('with the switch off a service completes without assignees', function () {
    $this->tenant->forceFill([
        'settings' => array_merge($this->tenant->settings ?? [], [
            'require_staff_on_complete' => false,
        ]),
    ])->save();

    $this->service->update(['staffing' => ServiceStaffing::WASHER_DRYER]);
    $log = ($this->log)();

    ($this->as)($this->owner)
        ->patchJson("/api/v1/service-logs/{$log->id}/complete")
        ->assertOk();

    expect($log->fresh()->status)->toBe('completed');
});

test('the switch defaults to on, so nobody loses the rule in a deploy', function () {
    // Sin la clave en settings —que es como están todos los tenants hoy— la
    // exigencia sigue en pie.
    expect($this->tenant->settings['require_staff_on_complete'] ?? null)->toBeNull();

    $this->service->update(['staffing' => ServiceStaffing::WASHER_DRYER]);
    $log = ($this->log)();

    ($this->as)($this->owner)
        ->patchJson("/api/v1/service-logs/{$log->id}/complete")
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'ASSIGNEES_REQUIRED');
});

test('with the switch off the assignees can still be recorded', function () {
    // Apagar la exigencia no apaga la función: quien quiera anotarlo, puede.
    $this->tenant->forceFill([
        'settings' => array_merge($this->tenant->settings ?? [], [
            'require_staff_on_complete' => false,
        ]),
    ])->save();

    $log = ($this->log)();

    ($this->as)($this->owner)
        ->patchJson("/api/v1/service-logs/{$log->id}/assignees", [
            'washed_by' => $this->washer->id,
        ])
        ->assertOk();

    expect($log->fresh()->washed_by)->toBe($this->washer->id);
});
