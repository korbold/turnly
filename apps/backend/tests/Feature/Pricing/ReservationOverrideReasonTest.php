<?php
// apps/backend/tests/Feature/Pricing/ReservationOverrideReasonTest.php

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ReservationItemChangeModel;
use App\Infrastructure\Persistence\Models\ReservationItemModel;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\ServiceVariantModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    $this->cashier = UserModel::factory()->create();
    TenantUserModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
        'user_id' => $this->cashier->id, 'role' => 'cashier', 'is_active' => true,
    ]);

    $service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id, 'price' => 15.00]);

    // reservations.client_id and .client_resource_id are NOT NULL; the
    // brief's fixture omitted both and the insert failed the constraints,
    // so they're filled here.
    $clientResource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $this->cashier->id,
        'type' => 'sedan',
    ]);

    $this->reservation = ReservationModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $this->cashier->id,
        'client_resource_id' => $clientResource->id,
        'service_id' => $service->id,
        'created_by' => $this->cashier->id,
        'status' => 'checked_in',
        'payment_status' => 'unpaid',
        'scheduled_at' => now(),
    ]);

    // reservation_items.item_type only allows 'service_variant' or
    // 'product' at the DB level (CHECK constraint); the brief's fixture
    // used 'service', which the enum rejects, so a real variant is used.
    $variant = ServiceVariantModel::create([
        'id' => (string) Str::uuid(),
        'tenant_id' => $this->tenant->id,
        'service_id' => $service->id,
        'label' => 'Lavado',
        'price' => 15.00,
    ]);

    $this->item = ReservationItemModel::create([
        'id' => (string) Str::uuid(),
        'tenant_id' => $this->tenant->id,
        'reservation_id' => $this->reservation->id,
        'item_type' => 'service_variant',
        'ref_id' => $variant->id,
        'label' => 'Lavado',
        'qty' => 1,
        'unit_price' => 15.00,
        'line_total' => 15.00,
    ]);

    $this->override = fn (array $body) => $this->actingAs($this->cashier)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->patchJson("/api/v1/reservation-items/{$this->item->id}/price", $body);
});

test('a free-text reason is no longer enough', function () {
    // Antes aceptaba cualquier texto, incluido "cliente especial", que es la
    // excusa que este diseño existe para volver auditable.
    ($this->override)(['unit_price' => 12.00, 'reason' => 'cliente especial'])
        ->assertStatus(422);

    expect((float) $this->item->fresh()->unit_price)->toBe(15.0);
});

test('a code from the list goes through and is stored', function () {
    ($this->override)([
        'unit_price'  => 12.00,
        'reason_code' => 'cliente_frecuente',
    ])->assertOk();

    expect((float) $this->item->fresh()->unit_price)->toBe(12.0);

    $audit = ReservationItemChangeModel::withoutGlobalScopes()
        ->where('action', 'price_override')->first();
    expect($audit->reason_code)->toBe('cliente_frecuente');
    expect((float) $audit->old_price)->toBe(15.0);
    expect((float) $audit->new_price)->toBe(12.0);
    expect($audit->changed_by_user_id)->toBe($this->cashier->id);
});

test('otro still demands the note', function () {
    ($this->override)(['unit_price' => 12.00, 'reason_code' => 'otro'])
        ->assertStatus(422);

    ($this->override)([
        'unit_price'  => 12.00,
        'reason_code' => 'otro',
        'reason'      => 'amigo del dueño',
    ])->assertOk();
});

test('an unknown code is refused', function () {
    ($this->override)(['unit_price' => 12.00, 'reason_code' => 'porque_si'])
        ->assertStatus(422);
});
