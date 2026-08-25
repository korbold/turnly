<?php
// apps/backend/tests/Feature/Cash/CashDenominationTest.php
//
// Contar el cajón por denominación, que es como se cuenta de verdad.
//
// El arqueo del 24 de agosto declaró $464.00 — al centavo, el efectivo
// cobrado — cuando el cajón además debía tener la base. Pedir un total en un
// campo vacío deja que ese número salga de cualquier lado. Pedir "cuántos
// billetes de $20" obliga a meter la mano en el cajón, y de paso el total lo
// suma el sistema.
//
// El desglose por denominación con acta firmada es el procedimiento estándar
// de arqueo en Ecuador.

use App\Infrastructure\Persistence\Models\CashSessionModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    $user = UserModel::factory()->create(['name' => 'Vanessa']);
    TenantUserModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
        'user_id' => $user->id, 'role' => 'cashier', 'is_active' => true,
    ]);
    $this->vanessa = $user;

    $this->as = fn (UserModel $u) => $this->actingAs($u)
        ->withHeader('X-Tenant', $this->tenant->slug);

    $this->abrir = fn (float $base = 40.00) => ($this->as)($this->vanessa)
        ->postJson('/api/v1/cash-sessions', ['opening_amount' => $base])
        ->json('data.id');
});

test('the counted total is the sum of the denominations', function () {
    // 2×$20 + 1×$10 + 3×$1 + 4×25¢ + 2×10¢ = $54.20. Las monedas van en
    // centavos: ver CashCount::COINS.
    $id = ($this->abrir)();

    $r = ($this->as)($this->vanessa)
        ->postJson("/api/v1/cash-sessions/{$id}/close", [
            'breakdown' => [
                'bills' => ['20' => 2, '10' => 1, '1' => 3],
                'coins' => ['25' => 4, '10' => 2],
            ],
        ])
        ->assertOk();

    expect((float) $r->json('data.counted_amount'))->toBe(54.20);
});

test('the breakdown is kept, not just its total', function () {
    // Sin el detalle, un arqueo discutido no se puede reconstruir: "conté
    // $54.20" no dice si faltó un billete de $20 o veinte monedas.
    $id = ($this->abrir)();

    ($this->as)($this->vanessa)
        ->postJson("/api/v1/cash-sessions/{$id}/close", [
            'breakdown' => ['bills' => ['20' => 2], 'coins' => []],
        ]);

    $desglose = CashSessionModel::find($id)->counted_breakdown;

    expect($desglose['bills']['20'])->toBe(2);
});

test('a total sent by hand does not override the count', function () {
    // El total es una consecuencia del conteo, no un dato que se pueda
    // declarar: si viajara aparte, volvería a existir el campo donde se
    // escribe un número que nadie contó.
    $id = ($this->abrir)();

    $r = ($this->as)($this->vanessa)
        ->postJson("/api/v1/cash-sessions/{$id}/close", [
            'breakdown'      => ['bills' => ['20' => 2], 'coins' => []],
            'counted_amount' => 999.00,
        ]);

    expect((float) $r->json('data.counted_amount'))->toBe(40.0);
});

test('other values in the drawer are counted too, with what they are', function () {
    // La práctica ecuatoriana los nombra: vales, cheques, vouchers.
    $id = ($this->abrir)();

    $r = ($this->as)($this->vanessa)
        ->postJson("/api/v1/cash-sessions/{$id}/close", [
            'breakdown' => [
                'bills' => ['20' => 1],
                'coins' => [],
                'other_amount' => 5.00,
                'other_note'   => 'Vale de almuerzo',
            ],
        ])
        ->assertOk();

    expect((float) $r->json('data.counted_amount'))->toBe(25.0);
    expect(CashSessionModel::find($id)->counted_breakdown['other_note'])->toBe('Vale de almuerzo');
});

test('other values need to say what they are', function () {
    $id = ($this->abrir)();

    ($this->as)($this->vanessa)
        ->postJson("/api/v1/cash-sessions/{$id}/close", [
            'breakdown' => ['bills' => [], 'coins' => [], 'other_amount' => 5.00],
        ])
        ->assertStatus(422);
});

test('an unknown denomination is refused', function () {
    // No existe un billete de $3. Aceptarlo sería aceptar cualquier número
    // escrito en cualquier casilla.
    $id = ($this->abrir)();

    ($this->as)($this->vanessa)
        ->postJson("/api/v1/cash-sessions/{$id}/close", [
            'breakdown' => ['bills' => ['3' => 5], 'coins' => []],
        ])
        ->assertStatus(422);
});

test('an empty drawer is a valid count', function () {
    // Cero es un resultado, no un formulario sin llenar: si el cajón está
    // vacío hay que poder decirlo.
    $id = ($this->abrir)(0.00);

    $r = ($this->as)($this->vanessa)
        ->postJson("/api/v1/cash-sessions/{$id}/close", [
            'breakdown' => ['bills' => [], 'coins' => []],
        ])
        ->assertOk();

    expect((float) $r->json('data.counted_amount'))->toBe(0.0);
});

test('closing without a breakdown still works', function () {
    // Las cajas que ya se cerraron con un total suelto siguen siendo válidas,
    // y el móvil o un script no se rompen por esto.
    $id = ($this->abrir)();

    $r = ($this->as)($this->vanessa)
        ->postJson("/api/v1/cash-sessions/{$id}/close", ['counted_amount' => 464.00])
        ->assertOk();

    expect((float) $r->json('data.counted_amount'))->toBe(464.0);
    expect(CashSessionModel::find($id)->counted_breakdown)->toBeNull();
});

test('the cent arithmetic does not drift', function () {
    // 3×1¢ + 1×5¢ + 2×10¢ = $0.28, y no $0.27999999.
    $id = ($this->abrir)(0.00);

    $r = ($this->as)($this->vanessa)
        ->postJson("/api/v1/cash-sessions/{$id}/close", [
            'breakdown' => ['bills' => [], 'coins' => ['1' => 3, '5' => 1, '10' => 2]],
        ]);

    expect((float) $r->json('data.counted_amount'))->toBe(0.28);
});
