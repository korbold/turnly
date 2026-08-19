# Abono (libro de pagos, fase 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un servicio de $30 se pueda cobrar en dos veces — $10 al dejar el auto, $20 al retirarlo — sin que ninguna cifra del sistema mienta mientras tanto.

**Architecture:** Cero tablas nuevas. `PaymentLedger` ya escribe pagos parciales y `payment_status` ya acepta `'partial'` desde la fase 1: lo que falta es dejar que la UI pida un monto, que las pantallas entiendan el tercer estado, y que los dos reportes que todavía suman `price_charged` por método pasen al libro antes de que empiecen a mentir.

**Tech Stack:** Laravel 13 (Domain → Application → Infrastructure), Pest + SQLite en memoria; Next.js 16 + React Query + shadcn/ui en `apps/admin-v2`.

**Spec:** `docs/superpowers/specs/2026-08-19-abono-y-deuda-design.md` (Fase 3 — Abono). El spec base es `docs/superpowers/specs/2026-08-18-libro-de-pagos-caja-abono-deuda-design.md`.

**Fases previas:** `2026-08-18-libro-de-pagos-fase-1.md` y `2026-08-19-libro-de-pagos-fase-2-caja.md`, ambas construidas. Existen `payments`, `payment_allocations`, `PaymentLedger`, `cash_sessions` y `CashRegister`.

## Global Constraints

- **`partial` no es un estado nuevo: ya existe.** `PaymentLedger::statusFor()` lo devuelve desde la fase 1 y la columna lo acepta. Ninguna tarea de este plan escribe `payment_status` a mano — sale del ledger, siempre.
- **El bug central es de UI, no de datos.** Media docena de lugares hacen `paymentStatus === 'unpaid'` para decidir «¿falta cobrar?». Con `partial` esa comparación da `false` y la fila se muestra como pagada, sin botón de Cobrar. La regla nueva es **`!== 'paid'`**, y hay que aplicarla en todos.
- **Facturar exige pago total.** Una factura del SRI es por el total del servicio. Con saldo pendiente el botón se deshabilita y dice por qué.
- **Completar NO exige pago total.** El auto puede estar lavado y el cliente deber. Son ejes distintos.
- **`amount` en un cobro es opcional y por defecto es el saldo pendiente.** Un cliente que no manda el campo se comporta exactamente como hoy. Esto es lo que hace que la fase no rompa la app móvil ni ningún consumidor existente.
- Modelos en `app/Infrastructure/Persistence/Models/`. Servicios de aplicación en `app/Application/Services/`.
- Tests backend: `cd apps/backend && ./vendor/bin/pest <ruta>`.
- **La suite tiene 9 fallos PRE-EXISTENTES** (5 en `ClientResourceTest`, 3 en `ReservationInvoiceTest`, 1 en `ServiceLogTest > create service log requires required fields`). No son tuyos. El verde de partida es **458 passed**.
- **La suite de `tests/Feature/Report/` se saltea entera en SQLite** (9 skipped): esos tests corren contra MySQL porque `whereBetween` sobre `log_date` no encuentra nada en SQLite. Si tocás reportes y la suite queda verde, no probaste nada — leé la Task 1 Step 2.
- `npm run lint` en el admin **ya está rojo** (48 errores pre-existentes, casi todos `react-hooks/set-state-in-effect` en 36 archivos). El gate real es `npx tsc --noEmit && npm run build`. Corrélos hasta el final.
- Admin: Next.js 16. Antes de escribir código de Next, leé la guía en `apps/admin-v2/node_modules/next/dist/docs/`.

---

### Task 1: Los reportes dejan de sumar precios

**Files:**
- Modify: `apps/backend/app/Infrastructure/Http/Controllers/Report/ReportController.php` (`range()` ~líneas 156-205, `monthly()` ~líneas 384-388)
- Test: `apps/backend/tests/Feature/Payment/ReportsRangeFromLedgerTest.php`

**Interfaces:**
- Consumes: `PaymentModel` (fase 1).
- Produces: nada nuevo.

**Por qué esto va primero.** La fase 2 movió `daily()` al libro y dejó `range()` y `monthly()` señalados. Hoy no mienten porque todo pago es completo. **El primer abono los rompe**: un servicio de $30 con $10 cobrados suma $30 al bucket de efectivo, porque `payment_method` de la fila dice `cash` y el bucket suma `price_charged`. Si el abono entra antes que este arreglo, el reporte miente y nadie sabe desde cuándo.

**Tres cifras a corregir en `range()`, no una:**

1. `$byPaymentMethod` (vía el closure `$methodTotal`) — suma `price_charged` por método.
2. `$byBank`, la parte de `$transferLogs` — mismo problema, un nivel abajo.
3. `$unpaidRevenue` / `$collectedRevenue` — **este es el que muerde en silencio**. `$unpaidLogs = $washLogs->where('payment_status', 'unpaid')`: un log en `partial` no es `'unpaid'`, así que sale del conteo de impago, y como `collected = total − unpaid`, sus $30 completos se cuentan como cobrados. Hay que sumar el saldo real.

`monthly()` sólo tiene el problema (1).

**Lo que NO cambia:** el filtro `?payment_method=` de la lista. Filtrar servicios por su método es una pregunta distinta de sumar plata, y la columna derivada sigue reflejando el último pago.

- [ ] **Step 1: Write the failing test**

```php
<?php
// apps/backend/tests/Feature/Payment/ReportsRangeFromLedgerTest.php

use App\Application\Services\PaymentLedger;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

// Igual que el resto de tests/Feature/Report: `whereBetween` sobre log_date no
// encuentra nada en SQLite, así que esta suite corre contra MySQL o no corre.
beforeEach(function () {
    if (config('database.default') === 'sqlite') {
        $this->markTestSkipped('Los reportes se prueban contra MySQL: en SQLite log_date conserva la hora y whereBetween no encuentra nada.');
    }

    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    $this->owner = UserModel::factory()->create();
    TenantUserModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
        'user_id' => $this->owner->id, 'role' => 'owner', 'is_active' => true,
    ]);

    $service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->owner->id, 'type' => 'sedan',
    ]);

    $this->log = fn (float $price) => ServiceLogModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $resource->id,
        'service_id' => $service->id,
        'attended_by' => $this->owner->id,
        'created_by' => $this->owner->id,
        'price_charged' => $price,
        'payment_status' => 'unpaid',
        'paid_at' => null,
        'payment_method' => null,
        'log_date' => now()->toDateString(),
    ]);

    $this->ledger = app(PaymentLedger::class);
    $this->hoy = now()->toDateString();

    $this->range = fn () => $this->actingAs($this->owner)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson("/api/v1/reports/range?date_from={$this->hoy}&date_to={$this->hoy}");
});

test('the method bucket counts money received, not the price of the service', function () {
    $log = ($this->log)(30.00);
    $this->ledger->recordForServiceLog($log, 10.00, 'cash', null, $this->owner->id);

    ($this->range)()
        ->assertOk()
        ->assertJsonPath('data.by_payment_method.cash.total', 10);
});

test('a partial payment is not silently counted as collected', function () {
    // El que muerde en silencio: `where('payment_status','unpaid')` deja fuera
    // a un log 'partial', y collected = total − unpaid se come los $30.
    ($this->log)(30.00);
    $log = ServiceLogModel::withoutGlobalScopes()->latest('created_at')->first();
    $this->ledger->recordForServiceLog($log, 10.00, 'cash', null, $this->owner->id);

    ($this->range)()
        ->assertOk()
        ->assertJsonPath('data.stats.collected_revenue', 10)
        ->assertJsonPath('data.stats.unpaid_revenue', 20)
        ->assertJsonPath('data.stats.total_revenue', 30);
});

test('the bank breakdown counts money received too', function () {
    $log = ($this->log)(40.00);
    $this->ledger->recordForServiceLog($log, 25.00, 'transfer', 'pichincha', $this->owner->id);

    ($this->range)()
        ->assertOk()
        ->assertJsonPath('data.by_bank.pichincha.total', 25);
});

test('a fully paid day reports exactly what it reported before', function () {
    // El criterio de no-regresión: con pagos completos, sumar montos y sumar
    // precios da lo mismo.
    $a = ($this->log)(15.00);
    $b = ($this->log)(25.00);
    $this->ledger->recordForServiceLog($a, 15.00, 'cash', null, $this->owner->id);
    $this->ledger->recordForServiceLog($b, 25.00, 'card', null, $this->owner->id);

    ($this->range)()
        ->assertOk()
        ->assertJsonPath('data.by_payment_method.cash.total', 15)
        ->assertJsonPath('data.by_payment_method.card.total', 25)
        ->assertJsonPath('data.stats.collected_revenue', 40)
        ->assertJsonPath('data.stats.unpaid_revenue', 0);
});

test('the monthly report counts money received', function () {
    $log = ($this->log)(30.00);
    $this->ledger->recordForServiceLog($log, 10.00, 'cash', null, $this->owner->id);

    $this->actingAs($this->owner)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson('/api/v1/reports/monthly?month=' . now()->format('Y-m'))
        ->assertOk()
        ->assertJsonPath('data.by_payment_method.cash', 10);
});
```

- [ ] **Step 2: Run test to verify it fails — against MySQL**

Run:
```bash
cd apps/backend
mysql -h127.0.0.1 -uroot -e "DROP DATABASE IF EXISTS turnly_test; CREATE DATABASE turnly_test;"
DB_CONNECTION=mysql DB_DATABASE=turnly_test php artisan migrate --force
DB_CONNECTION=mysql DB_DATABASE=turnly_test ./vendor/bin/pest tests/Feature/Payment/ReportsRangeFromLedgerTest.php
```

Expected: FAIL — `by_payment_method.cash.total` da `30` en vez de `10`, y `collected_revenue` da `30` en vez de `10`.

**Si corrés esto contra SQLite los 5 tests se saltean y parece que pasaron.** No es verde: es que no corrieron.

- [ ] **Step 3: Rewire `range()`**

En `range()`, después de la línea `$collectedRevenue = $totalRevenue - $unpaidRevenue;`, todo el bloque de buckets cambia de fuente. Reemplazá desde el comentario `// Per-method buckets (Phase 1 payments live on the reservation` hasta el cierre del `foreach ($transferLogs->groupBy(...))` por esto:

```php
        // Plata recibida en el rango, del libro de pagos. Sumar price_charged
        // por método miente en cuanto existe un abono: un servicio de $30 con
        // $10 cobrados sumaría $30 al bucket de efectivo.
        //
        // Se filtra por `paid_at` y no por log_date: un servicio de ayer
        // cobrado hoy es plata de hoy. Es el mismo criterio que la caja.
        $pagos = \App\Infrastructure\Persistence\Models\PaymentModel::query()
            ->forTenant(app('current_tenant_id'))
            ->whereBetween('paid_at', [$from . ' 00:00:00', $to . ' 23:59:59'])
            ->get();

        if ($methodFilter) {
            $pagos = $pagos->where('method', $methodFilter);
        }
        if ($bankFilter) {
            $pagos = $pagos->where('bank', $bankFilter);
        }

        $paidReservations = $reservations->where('payment_status', 'paid');

        $methodTotal = function (string $method) use ($pagos, $paidReservations, $totalForReservation): array {
            $delMetodo = $pagos->where('method', $method);
            $res       = $paidReservations->where('payment_method', $method);
            return [
                'count' => $delMetodo->count() + $res->count(),
                'total' => (float) $delMetodo->sum('amount') + (float) $res->sum($totalForReservation),
            ];
        };
        $byPaymentMethod = [
            'cash'     => $methodTotal('cash'),
            'card'     => $methodTotal('card'),
            'transfer' => $methodTotal('transfer'),
        ];

        // Desglose por banco de la tajada de transferencias. Las reservas
        // siguen aportando desde su propia columna; los cobros del mostrador
        // ahora salen del libro.
        $transferReservations = $paidReservations
            ->where('payment_method', 'transfer')
            ->whereNotNull('payment_bank');

        $byBank = [];
        foreach ($transferReservations->groupBy('payment_bank') as $slug => $rows) {
            $byBank[$slug] = [
                'count' => $rows->count(),
                'total' => (float) $rows->sum($totalForReservation),
            ];
        }
        foreach ($pagos->where('method', 'transfer')->whereNotNull('bank')->groupBy('bank') as $slug => $rows) {
            $byBank[$slug] = [
                'count' => ($byBank[$slug]['count'] ?? 0) + $rows->count(),
                'total' => ($byBank[$slug]['total'] ?? 0.0) + (float) $rows->sum('amount'),
            ];
        }
```

Y **arriba**, reemplazá el cálculo de impago. Hoy dice:

```php
        $unpaidLogs = $washLogs->where('payment_status', 'unpaid');
        $unpaidRes  = $reservations->where('payment_status', 'unpaid');
        $unpaidRevenue = (float) $unpaidLogs->sum('price_charged')
            + (float) $unpaidRes->sum($totalForReservation);
        $collectedRevenue = $totalRevenue - $unpaidRevenue;
```

Pasa a:

```php
        // Un log en 'partial' no es 'unpaid', así que el filtro viejo lo dejaba
        // fuera del impago — y como collected = total − unpaid, sus $30
        // completos se contaban como cobrados con $10 en la caja. Lo que se
        // debe de un servicio es su precio menos lo que se le abonó.
        $ledger = app(\App\Application\Services\PaymentLedger::class);

        $unpaidLogs = $washLogs->filter(fn ($l) => $l->payment_status !== 'paid');
        $unpaidRes  = $reservations->where('payment_status', 'unpaid');

        $unpaidRevenue = (float) $unpaidLogs->sum(
            fn ($l) => max(0.0, (float) $l->price_charged - $ledger->paidFor($l))
        ) + (float) $unpaidRes->sum($totalForReservation);

        $collectedRevenue = $totalRevenue - $unpaidRevenue;
```

`unpaid_count` sigue contando filas (`$unpaidLogs->count() + $unpaidRes->count()`), que es lo que la pantalla muestra: cuántos servicios deben algo, no cuántos dólares.

- [ ] **Step 4: Rewire `monthly()`**

En `monthly()`, después de la línea `$totalRevenue = (float) $washLogs->sum('price_charged') + $reservationRevenue;`, agregá:

```php
        // Misma razón que en range(): los buckets cuentan plata recibida.
        $pagosDelMes = \App\Infrastructure\Persistence\Models\PaymentModel::query()
            ->forTenant(app('current_tenant_id'))
            ->whereBetween('paid_at', [$startDate . ' 00:00:00', $endDate . ' 23:59:59'])
            ->get();
```

y reemplazá el bloque `'by_payment_method' => [...]` por:

```php
                'by_payment_method' => [
                    'cash'     => (float) $pagosDelMes->where('method', 'cash')->sum('amount'),
                    'card'     => (float) $pagosDelMes->where('method', 'card')->sum('amount'),
                    'transfer' => (float) $pagosDelMes->where('method', 'transfer')->sum('amount'),
                ],
```

`total_revenue` y `average_daily_washes` **no cambian**: describen servicios registrados, no plata.

- [ ] **Step 5: Run test to verify it passes**

Run:
```bash
cd apps/backend
DB_CONNECTION=mysql DB_DATABASE=turnly_test ./vendor/bin/pest tests/Feature/Payment/ReportsRangeFromLedgerTest.php
```
Expected: PASS — 5 passed

- [ ] **Step 6: Run the whole reports suite against MySQL**

Run:
```bash
cd apps/backend
DB_CONNECTION=mysql DB_DATABASE=turnly_test ./vendor/bin/pest tests/Feature/Report/
```
Expected: verde, **y ninguno saltado**. Los tests viejos del rango tienen que seguir pasando sin editarlos: con pagos completos, sumar montos y sumar precios da lo mismo. Si alguno rompe, mirá si esperaba precios en vez de plata cobrada — y si es así, reportalo antes de tocarlo.

- [ ] **Step 7: Commit**

```bash
mysql -h127.0.0.1 -uroot -e "DROP DATABASE turnly_test;"
git add apps/backend/app/Infrastructure/Http/Controllers/Report/ReportController.php \
        apps/backend/tests/Feature/Payment/ReportsRangeFromLedgerTest.php
git commit -m "fix(reportes): count money received before the first abono makes the old sum a lie"
```

---

### Task 2: Cobrar un monto, no el total

**Files:**
- Modify: `apps/backend/app/Infrastructure/Http/Controllers/ServiceLog/ServiceLogController.php` (`store()` y `recordPayment()`)
- Modify: `apps/backend/app/Infrastructure/Http/Requests/ServiceLog/CreateServiceLogRequest.php`
- Modify: `apps/backend/app/Application/Services/ServiceLogEventRecorder.php` (`paymentRecorded`)
- Modify: `apps/backend/app/Infrastructure/Http/Resources/ServiceLogResource.php`
- Test: `apps/backend/tests/Feature/Payment/PartialPaymentTest.php`

**Interfaces:**
- Consumes: `PaymentLedger` (fase 1).
- Produces:
  - `POST /service-logs` acepta `amount_received` (nullable, numeric, min 0.01).
  - `POST /service-logs/{id}/payment` acepta `amount` (nullable, numeric, min 0.01). Sin él, cobra el saldo pendiente — el comportamiento de hoy.
  - `ServiceLogResource` gana `amount_paid` (float) y `amount_due` (float).
  - `ServiceLogEventRecorder::paymentRecorded(...)` gana un parámetro `float $remaining` al final.

**Por qué `amount` es opcional:** la app móvil y cualquier consumidor existente siguen mandando lo mismo y obtienen lo mismo. Un parámetro obligatorio nuevo rompería a todos para servir a uno.

- [ ] **Step 1: Write the failing test**

```php
<?php
// apps/backend/tests/Feature/Payment/PartialPaymentTest.php

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\PaymentModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    $this->owner = UserModel::factory()->create();
    TenantUserModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
        'user_id' => $this->owner->id, 'role' => 'owner', 'is_active' => true,
    ]);

    $this->service = ServiceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'price' => 30.00,
    ]);
    $this->resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->owner->id, 'type' => 'sedan',
    ]);

    $this->as = fn () => $this->actingAs($this->owner)
        ->withHeader('X-Tenant', $this->tenant->slug);

    $this->register = fn (array $extra = []) => ($this->as)()
        ->postJson('/api/v1/service-logs', array_merge([
            'client_resource_id' => $this->resource->id,
            'attended_by'        => $this->owner->id,
            'items'              => [[
                'service_id' => $this->service->id, 'label' => 'Lavado',
                'qty' => 1, 'unit_price' => 30.00,
            ]],
            'payment_method' => 'cash',
        ], $extra));
});

test('registering with a partial amount leaves the service partial', function () {
    // La escena: deja el auto y paga $10 de $30.
    $res = ($this->register)(['amount_received' => 10.00])->assertStatus(201);

    expect($res->json('data.payment_status'))->toBe('partial');
    expect($res->json('data.amount_paid'))->toBe(10.0);
    expect($res->json('data.amount_due'))->toBe(20.0);
    expect((float) PaymentModel::withoutGlobalScopes()->sum('amount'))->toBe(10.0);
});

test('registering without an amount still charges the whole thing', function () {
    // Nadie que no conozca el campo nuevo cambia de comportamiento.
    $res = ($this->register)()->assertStatus(201);

    expect($res->json('data.payment_status'))->toBe('paid');
    expect($res->json('data.amount_due'))->toBe(0.0);
});

test('collecting the rest closes the service', function () {
    $id = ($this->register)(['amount_received' => 10.00])->json('data.id');

    $res = ($this->as)()
        ->postJson("/api/v1/service-logs/{$id}/payment", ['method' => 'cash', 'amount' => 20.00])
        ->assertOk();

    expect($res->json('data.payment_status'))->toBe('paid');
    expect($res->json('data.amount_due'))->toBe(0.0);
    expect((float) PaymentModel::withoutGlobalScopes()->sum('amount'))->toBe(30.0);
    expect(PaymentModel::withoutGlobalScopes()->count())->toBe(2);
});

test('collecting without an amount pays off whatever is left', function () {
    // El diálogo viejo, y la app móvil, mandan sólo el método.
    $id = ($this->register)(['amount_received' => 10.00])->json('data.id');

    ($this->as)()
        ->postJson("/api/v1/service-logs/{$id}/payment", ['method' => 'cash'])
        ->assertOk()
        ->assertJsonPath('data.payment_status', 'paid');

    expect((float) PaymentModel::withoutGlobalScopes()->sum('amount'))->toBe(30.0);
});

test('a second partial keeps it partial', function () {
    $id = ($this->register)(['amount_received' => 10.00])->json('data.id');

    $res = ($this->as)()
        ->postJson("/api/v1/service-logs/{$id}/payment", ['method' => 'cash', 'amount' => 5.00])
        ->assertOk();

    expect($res->json('data.payment_status'))->toBe('partial');
    expect($res->json('data.amount_paid'))->toBe(15.0);
    expect($res->json('data.amount_due'))->toBe(15.0);
});

test('a paid service is still refused a second collection', function () {
    // El guard de ALREADY_PAID no se toca: cobrarle dos veces al mismo
    // servicio completo sigue siendo un error, no un abono.
    $id = ($this->register)()->json('data.id');

    ($this->as)()
        ->postJson("/api/v1/service-logs/{$id}/payment", ['method' => 'cash', 'amount' => 5.00])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'ALREADY_PAID');
});

test('the trail records what was paid and what is left', function () {
    $id = ($this->register)(['amount_received' => 10.00])->json('data.id');

    $evento = \App\Infrastructure\Persistence\Models\ServiceLogEventModel::withoutGlobalScopes()
        ->where('service_log_id', $id)
        ->where('event', 'payment_recorded')
        ->first();

    expect((float) $evento->detail['amount'])->toBe(10.0);
    expect((float) $evento->detail['remaining'])->toBe(20.0);
});

test('an unpaid service reports the whole price as due', function () {
    $res = ($this->register)(['payment_status' => 'unpaid'])->assertStatus(201);

    expect($res->json('data.payment_status'))->toBe('unpaid');
    expect($res->json('data.amount_paid'))->toBe(0.0);
    expect($res->json('data.amount_due'))->toBe(30.0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Payment/PartialPaymentTest.php`
Expected: FAIL — `amount_paid` no existe en la respuesta y el primer registro sale `paid`.

- [ ] **Step 3: Expose the two figures on the resource**

En `apps/backend/app/Infrastructure/Http/Resources/ServiceLogResource.php`, junto a
`'payment_status'`, agregá:

```php
            // Lo abonado y lo que falta. Salen del libro, no de la fila: la
            // fila sólo sabe si está pagado, no cuánto entró.
            'amount_paid'    => round($this->amountPaidFromLedger(), 2),
            'amount_due'     => round(max(0.0, (float) $this->price_charged - $this->amountPaidFromLedger()), 2),
```

y al final de la clase:

```php
    /**
     * Memoizado por instancia: `toArray` lo necesita dos veces y una colección
     * de 15 filas haría 30 consultas por una sola pantalla.
     */
    private ?float $paidCache = null;

    private function amountPaidFromLedger(): float
    {
        return $this->paidCache ??= app(\App\Application\Services\PaymentLedger::class)
            ->paidFor($this->resource);
    }
```

- [ ] **Step 4: Let the trail carry the remaining balance**

En `apps/backend/app/Application/Services/ServiceLogEventRecorder.php`, `paymentRecorded`
gana un parámetro al final y una clave en el detalle:

```php
    public function paymentRecorded(
        ServiceLogModel $log,
        string $method,
        ?string $bank,
        float $amount,
        ?string $actorId,
        float $remaining = 0.0,
    ): void {
        $this->write($log, ServiceLogEventModel::EVENT_PAYMENT_RECORDED, [
            'method'    => $method,
            'bank'      => $bank,
            'amount'    => $amount,
            // Lo que faltaba después de este cobro. Sin esto la bitácora
            // muestra tres pagos sueltos y nadie puede reconstruir si el
            // servicio quedó saldado o no.
            'remaining' => $remaining,
        ], $actorId);
    }
```

Default `0.0` para no romper llamadores que no lo pasen todavía.

- [ ] **Step 5: Accept the amount when registering**

En `apps/backend/app/Infrastructure/Http/Requests/ServiceLog/CreateServiceLogRequest.php`,
junto a `payment_method`:

```php
            // Abono al registrar: el cliente deja el auto y paga una parte.
            // Sin el campo, se cobra el total, que es como se comportaba antes.
            'amount_received' => ['nullable', 'numeric', 'min:0.01'],
```

En `ServiceLogController::store()`, el bloque que cobra hoy dice
`(float) $logModel->price_charged`. Pasa a:

```php
        // Cobrar al registrar es un cobro: entra al libro como cualquier otro.
        if ($paymentStatus !== 'unpaid') {
            $total   = (float) $logModel->price_charged;
            // Sin `amount_received` se cobra todo: es el registro de siempre.
            $recibido = $request->filled('amount_received')
                ? min((float) $request->input('amount_received'), $total)
                : $total;

            $this->ledger->recordForServiceLog(
                $logModel,
                $recibido,
                (string) $request->payment_method,
                $request->payment_bank,
                $request->user()?->id,
            );
            $logModel->refresh();

            $this->events->paymentRecorded(
                $logModel,
                (string) $logModel->payment_method,
                $logModel->payment_bank,
                $recibido,
                $request->user()?->id,
                max(0.0, $total - $this->ledger->paidFor($logModel)),
            );
        }
```

El `min(...)` con el total no es defensa contra el usuario: es lo que evita que
un dedo gordo en el mostrador convierta $300 en saldo a favor de un walk-in que
no vuelve nunca.

- [ ] **Step 6: Accept the amount when collecting**

En `ServiceLogController::recordPayment()`, la validación gana el campo:

```php
        $data = $request->validate([
            'method'    => ['required', 'in:cash,card,transfer,other'],
            'bank'      => ['nullable', 'string', 'max:40'],
            'reference' => ['nullable', 'string', 'max:100'],
            // Abono: cobrar menos que el saldo. Sin el campo se cobra todo lo
            // que falta, que es lo que hacía antes.
            'amount'    => ['nullable', 'numeric', 'min:0.01'],
        ]);
```

y el cobro pasa de `(float) $log->price_charged` al saldo:

```php
        $pendiente = max(0.0, (float) $log->price_charged - $this->ledger->paidFor($log));
        $monto = isset($data['amount'])
            ? min((float) $data['amount'], $pendiente)
            : $pendiente;

        $this->ledger->recordForServiceLog(
            $log,
            $monto,
            $data['method'],
            $data['bank'] ?? null,
            $request->user()?->id,
        );
```

El guard de `ALREADY_PAID` de arriba **no se toca**: sigue comparando
`$log->payment_status === 'paid'`, y un log en `partial` no lo es, así que pasa.

Y la llamada al evento, unas líneas más abajo, gana el saldo:

```php
        $this->events->paymentRecorded(
            $log,
            $data['method'],
            $data['method'] === 'transfer' ? ($data['bank'] ?? null) : null,
            $monto,
            $request->user()?->id,
            max(0.0, (float) $log->price_charged - $this->ledger->paidFor($log)),
        );
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Payment/PartialPaymentTest.php`
Expected: PASS — 8 passed

- [ ] **Step 8: Run every payment, cash and service-log test**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Payment/ tests/Feature/Cash/ tests/Feature/ServiceLog/`
Expected: sólo el fallo pre-existente `ServiceLogTest > create service log requires required fields`. Si rompe otro, diagnosticá — no edites su assert.

- [ ] **Step 9: Commit**

```bash
git add apps/backend/app/Infrastructure/Http/Controllers/ServiceLog/ServiceLogController.php \
        apps/backend/app/Infrastructure/Http/Requests/ServiceLog/CreateServiceLogRequest.php \
        apps/backend/app/Application/Services/ServiceLogEventRecorder.php \
        apps/backend/app/Infrastructure/Http/Resources/ServiceLogResource.php \
        apps/backend/tests/Feature/Payment/PartialPaymentTest.php
git commit -m "feat(abono): let a service be paid in parts, defaulting to the whole thing"
```

---

### Task 3: Facturar exige pago total

**Files:**
- Modify: `apps/backend/app/Infrastructure/Http/Controllers/ServiceLog/ServiceLogController.php` (`invoice()`)
- Test: `apps/backend/tests/Feature/Payment/InvoiceRequiresFullPaymentTest.php`

**Interfaces:**
- Consumes: `PaymentLedger`.
- Produces: `POST /service-logs/{id}/invoice` responde 422 `PAYMENT_INCOMPLETE` con saldo pendiente.

Una factura del SRI es por el total del servicio. Emitirla con saldo pendiente deja un comprobante autorizado que no refleja lo cobrado — y desde 2026 una factura a consumidor final **no se puede anular nunca**. El error es irreversible, así que el guard va en el backend y no sólo en el botón.

- [ ] **Step 1: Write the failing test**

```php
<?php
// apps/backend/tests/Feature/Payment/InvoiceRequiresFullPaymentTest.php

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    $this->owner = UserModel::factory()->create();
    TenantUserModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
        'user_id' => $this->owner->id, 'role' => 'owner', 'is_active' => true,
    ]);

    $service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id, 'price' => 30.00]);
    $resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->owner->id, 'type' => 'sedan',
    ]);

    $this->as = fn () => $this->actingAs($this->owner)
        ->withHeader('X-Tenant', $this->tenant->slug);

    $this->register = fn (array $extra = []) => ($this->as)()
        ->postJson('/api/v1/service-logs', array_merge([
            'client_resource_id' => $resource->id,
            'attended_by'        => $this->owner->id,
            'items'              => [[
                'service_id' => $service->id, 'label' => 'Lavado',
                'qty' => 1, 'unit_price' => 30.00,
            ]],
            'payment_method' => 'cash',
        ], $extra));
});

test('a partly paid service cannot be invoiced', function () {
    // Una factura del SRI es por el total, y desde 2026 una a consumidor final
    // no se puede anular nunca. El error sería irreversible.
    $id = ($this->register)(['amount_received' => 10.00])->json('data.id');

    ($this->as)()
        ->postJson("/api/v1/service-logs/{$id}/invoice")
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'PAYMENT_INCOMPLETE');
});

test('an unpaid service cannot be invoiced either', function () {
    $id = ($this->register)(['payment_status' => 'unpaid'])->json('data.id');

    ($this->as)()
        ->postJson("/api/v1/service-logs/{$id}/invoice")
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'PAYMENT_INCOMPLETE');
});

test('the error says how much is missing', function () {
    $id = ($this->register)(['amount_received' => 10.00])->json('data.id');

    $res = ($this->as)()->postJson("/api/v1/service-logs/{$id}/invoice");

    expect($res->json('error.message'))->toContain('20');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Payment/InvoiceRequiresFullPaymentTest.php`
Expected: FAIL — no hay 422; el método sigue de largo.

- [ ] **Step 3: Guard the invoice endpoint**

En `ServiceLogController::invoice()`, inmediatamente después de la línea que hace
`findOrFail` (antes de cualquier otra validación), agregá:

```php
        // Una factura del SRI es por el total del servicio. Con saldo
        // pendiente el comprobante no refleja lo cobrado — y desde 2026 una
        // factura a consumidor final no se puede anular nunca, así que el
        // error no tiene vuelta atrás.
        $pendiente = max(0.0, (float) $log->price_charged - $this->ledger->paidFor($log));
        if ($pendiente > 0.005) {
            return response()->json([
                'error' => [
                    'code'    => 'PAYMENT_INCOMPLETE',
                    'message' => 'No se puede facturar con saldo pendiente: faltan $'
                        . number_format($pendiente, 2) . '.',
                ],
            ], 422);
        }
```

El umbral `0.005` es el mismo centavo que usa `PaymentLedger::statusFor()`: sin
él, un servicio pagado en dos partes queda sin poder facturarse por un resto de
punto flotante.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Payment/InvoiceRequiresFullPaymentTest.php`
Expected: PASS — 3 passed

- [ ] **Step 5: Run the billing suite**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Billing/ tests/Feature/ServiceLog/`
Expected: los 3 fallos pre-existentes de `ReservationInvoiceTest` y el de `ServiceLogTest`, ni uno más.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/app/Infrastructure/Http/Controllers/ServiceLog/ServiceLogController.php \
        apps/backend/tests/Feature/Payment/InvoiceRequiresFullPaymentTest.php
git commit -m "feat(abono): refuse to invoice a service that is not fully paid"
```

---

### Task 4: El filtro y la lista entienden el tercer estado

**Files:**
- Modify: `apps/backend/app/Infrastructure/Http/Controllers/ServiceLog/ServiceLogController.php` (`index()`, ~línea 178)
- Test: `apps/backend/tests/Feature/Payment/PartialFilterTest.php`

**Interfaces:**
- Consumes: nada.
- Produces: `GET /service-logs?payment=partial` devuelve los abonados, y `?payment=pending` pasa a incluirlos.

**La decisión que importa:** `pending` deja de significar `payment_status = 'unpaid'` y pasa a significar **«algo falta cobrar»**, o sea `!= 'paid'`. Un servicio con $10 de $30 tiene plata pendiente; que el filtro «Pendiente» lo esconda es exactamente cómo se pierde un cobro. `partial` queda como filtro fino para ver sólo los abonados.

- [ ] **Step 1: Write the failing test**

```php
<?php
// apps/backend/tests/Feature/Payment/PartialFilterTest.php

use App\Application\Services\PaymentLedger;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    $this->owner = UserModel::factory()->create();
    TenantUserModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
        'user_id' => $this->owner->id, 'role' => 'owner', 'is_active' => true,
    ]);

    $service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->owner->id, 'type' => 'sedan',
    ]);
    $ledger = app(PaymentLedger::class);

    $mk = function (float $price, ?float $abona) use ($service, $resource, $ledger) {
        $log = ServiceLogModel::factory()->create([
            'tenant_id' => $this->tenant->id,
            'client_resource_id' => $resource->id,
            'service_id' => $service->id,
            'attended_by' => $this->owner->id,
            'created_by' => $this->owner->id,
            'price_charged' => $price,
            'payment_status' => 'unpaid',
            'paid_at' => null,
            'payment_method' => null,
            'log_date' => now()->toDateString(),
        ]);
        if ($abona !== null) {
            $ledger->recordForServiceLog($log, $abona, 'cash', null, $this->owner->id);
        }
        return $log->fresh();
    };

    $this->impago  = $mk(10.00, null);
    $this->abonado = $mk(30.00, 10.00);
    $this->pagado  = $mk(20.00, 20.00);

    $this->filtrar = fn (string $f) => $this->actingAs($this->owner)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson("/api/v1/service-logs?payment={$f}&date=" . now()->toDateString());
});

test('the partial filter shows only the ones with an abono', function () {
    $ids = collect(($this->filtrar)('partial')->assertOk()->json('data'))->pluck('id')->all();

    expect($ids)->toBe([$this->abonado->id]);
});

test('pending means something is still owed, abonos included', function () {
    // Que "Pendiente" esconda un servicio con $20 sin cobrar es exactamente
    // cómo se pierde un cobro.
    $ids = collect(($this->filtrar)('pending')->assertOk()->json('data'))->pluck('id')->all();

    expect($ids)->toHaveCount(2);
    expect($ids)->toContain($this->impago->id);
    expect($ids)->toContain($this->abonado->id);
});

test('paid still means paid', function () {
    $ids = collect(($this->filtrar)('paid')->assertOk()->json('data'))->pluck('id')->all();

    expect($ids)->toBe([$this->pagado->id]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Payment/PartialFilterTest.php`
Expected: FAIL — `partial` cae al `elseif` de métodos y no filtra nada; `pending` devuelve sólo el impago.

- [ ] **Step 3: Rewire the filter**

En `ServiceLogController::index()`, reemplazá el bloque del filtro de pago por:

```php
        // One control in the UI, mirroring the PAGO column: either a payment
        // state or a concrete method. They can't be combined — a pending row
        // has no method yet — so they share a single parameter.
        //
        // `pending` significa "algo falta cobrar", no "no se cobró nada": un
        // servicio con $10 de $30 tiene plata pendiente, y esconderlo del
        // filtro es cómo se pierde un cobro. `partial` es el filtro fino.
        $payment = (string) $request->get('payment', '');
        if ($payment === 'paid') {
            $query->where('payment_status', 'paid');
        } elseif ($payment === 'pending') {
            $query->where('payment_status', '!=', 'paid');
        } elseif ($payment === 'partial') {
            $query->where('payment_status', 'partial');
        } elseif (in_array($payment, ['cash', 'card', 'transfer', 'other'], true)) {
            $query->where('payment_method', $payment);
        }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Payment/PartialFilterTest.php`
Expected: PASS — 3 passed

- [ ] **Step 5: Commit**

```bash
git add apps/backend/app/Infrastructure/Http/Controllers/ServiceLog/ServiceLogController.php \
        apps/backend/tests/Feature/Payment/PartialFilterTest.php
git commit -m "feat(abono): pending means money is still owed, not that none came in"
```

---

### Task 5: El admin entiende el abono

**Files:**
- Modify: `apps/admin-v2/src/domain/entities/service-log.ts`
- Modify: `apps/admin-v2/src/domain/repositories/service-log.repository.ts` (`CreateServiceLogData`, línea 21)
- Modify: `apps/admin-v2/src/infrastructure/api/mappers/service-log.mapper.ts` (entrada, línea ~36)
- Modify: `apps/admin-v2/src/infrastructure/api/repositories/api-service-log.repository.ts` (`create()`, salida)
- Modify: `apps/admin-v2/src/presentation/components/features/service-logs/register-payment-dialog.tsx`
- Modify: `apps/admin-v2/src/presentation/components/features/service-logs/log-list.tsx`
- Modify: `apps/admin-v2/src/presentation/app/(tenant)/service-log/page.tsx`
- Modify: `apps/admin-v2/src/presentation/components/features/service-logs/new-service-modal.tsx`

**Interfaces:**
- Consumes: `amount_paid` / `amount_due` del recurso (Task 2), el filtro `partial` (Task 4).
- Produces: nada que otro consuma.

**El bug central de esta tarea.** Todo el árbol de decisiones de la fila cuelga de
`const isUnpaid = log.paymentStatus === 'unpaid'` (log-list.tsx:190). Con
`partial` eso da `false`, y entonces: la fila se pinta como saldada, la celda
PAGO muestra el método en vez de la deuda, **y el botón Cobrar desaparece** — el
servicio queda sin forma de cobrarse desde la lista. Renombrarlo a `isOwing` con
`!== 'paid'` es el cambio que hace funcionar la feature; los adornos vienen
después.

Sin test automatizado: `admin-v2` no tiene infraestructura de tests de
componentes. Se verifica en la Task 6, en el navegador.

- [ ] **Step 1: Widen the entity**

En `apps/admin-v2/src/domain/entities/service-log.ts`:

```ts
  paymentStatus: 'paid' | 'unpaid' | 'partial';
  /** Lo abonado y lo que falta, del libro de pagos. */
  amountPaid: number;
  amountDue: number;
```

y el filtro:

```ts
export type PaymentFilter = 'paid' | 'pending' | 'partial' | 'cash' | 'card' | 'transfer';
```

- [ ] **Step 2: Map the two new fields**

El mapper de entrada **no** vive en el repositorio: está en
`apps/admin-v2/src/infrastructure/api/mappers/service-log.mapper.ts`, y hay uno
solo (el repositorio lo reusa para lista y detalle). En la línea ~36, junto a
`paymentStatus`, agregá:

```ts
    amountPaid: Number(raw.amount_paid ?? 0),
    // Sin el campo (respuesta vieja en caché), lo que falta es todo el precio
    // si no está pagado: nunca mostrar "$0 pendiente" por un dato ausente.
    amountDue: raw.amount_due !== undefined
      ? Number(raw.amount_due)
      : (raw.payment_status === 'paid' ? 0 : Number(raw.price_charged ?? 0)),
```

- [ ] **Step 3: Add the amount field to the payment dialog**

En `register-payment-dialog.tsx`, la prop `total` pasa a ser el saldo pendiente y
se agrega un campo de monto. El componente gana:

```tsx
interface Props {
  serviceLogId: string;
  /** Saldo pendiente, no el precio del servicio. */
  total: number;
  open: boolean;
  onClose: () => void;
}
```

Dentro, junto a los otros `useState`:

```tsx
  // Arranca en el saldo: el caso normal sigue siendo cobrar todo lo que falta,
  // y el cajero sólo toca esto cuando el cliente abona menos.
  const [amount, setAmount] = useState('');
```

en el `useEffect` de apertura, `setAmount(total.toFixed(2));`, y antes del botón
de confirmar:

```tsx
        <div className="space-y-2">
          <Label htmlFor="payment-amount">Monto</Label>
          <Input
            id="payment-amount"
            type="number"
            inputMode="decimal"
            min={0.01}
            max={total}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          {Number(amount) > 0 && Number(amount) < total && (
            <p className="text-[12px] text-[var(--warning-700)]">
              Abono. Quedan {money(total - Number(amount))} por cobrar.
            </p>
          )}
        </div>
```

y la mutación manda `amount: Number(amount)`. Si el valor es igual al saldo, el
backend lo trata igual que antes.

- [ ] **Step 4: Fix the row's central decision**

En `log-list.tsx` línea ~190, reemplazá:

```tsx
        const isUnpaid = log.paymentStatus === 'unpaid';
```

por:

```tsx
        // "Falta cobrar", no "no se cobró nada": un servicio con $10 de $30
        // sigue necesitando el botón de Cobrar. Comparar contra 'unpaid'
        // dejaba los abonos sin forma de cobrarse desde la lista.
        const isOwing = log.paymentStatus !== 'paid';
        const isPartial = log.paymentStatus === 'partial';
```

y **renombrá todos los usos de `isUnpaid` a `isOwing`** en el archivo
(`grep -n "isUnpaid" src/presentation/components/features/service-logs/log-list.tsx`).
El tinte de la fila, la celda PAGO y el botón Cobrar cuelgan de él.

En la celda PAGO, el badge de Pendiente pasa a distinguir el abono:

```tsx
              {isOwing ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--warning-50)] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--warning-700)] ring-1 ring-[var(--warning-200)]">
                  <Wallet className="h-3 w-3" aria-hidden="true" />
                  {isPartial
                    ? `Abonado ${fmt(log.amountPaid)} · falta ${fmt(log.amountDue)}`
                    : 'Pendiente'}
                </span>
              ) : pmCfg ? (
```

y el botón Cobrar pasa el saldo, no el precio:

```tsx
      {payTarget && (
        <RegisterPaymentDialog
          serviceLogId={payTarget.id}
          total={payTarget.amountDue}
          open
          onClose={() => setPayTarget(null)}
        />
      )}
```

(buscá dónde se renderiza hoy con `grep -n "RegisterPaymentDialog" log-list.tsx`
y cambiá el `total`.)

- [ ] **Step 5: Disable Facturar while money is owed**

En `log-list.tsx`, dentro del IIFE que arma el botón de Facturar (~línea 377),
la línea `disabled={isEmitting}` pasa a:

```tsx
                        disabled={isEmitting || isOwing}
                        title={isOwing
                          ? `No se puede facturar con saldo pendiente: faltan ${fmt(log.amountDue)}.`
                          : undefined}
```

La mutación se llama `emitInvoiceMutation` y `isEmitting` ya está calculado unas
líneas arriba; la condición se **suma**, no lo reemplaza.

- [ ] **Step 6: Add the filter option**

En `apps/admin-v2/src/presentation/app/(tenant)/service-log/page.tsx`, en
`PAYMENT_OPTIONS`, entre Pendiente y Pagado:

```tsx
  { value: 'pending', label: 'Pendiente' },
  { value: 'partial', label: 'Abonado' },
  { value: 'paid', label: 'Pagado' },
```

- [ ] **Step 7: Add "Recibe ahora" to the registration modal**

En `new-service-modal.tsx`, donde se elige el método de pago, agregá un campo
opcional. Buscá el bloque con `grep -n "payment_method\|paymentMethod" new-service-modal.tsx`
y sumá, sólo cuando el cobro no está diferido:

```tsx
        <div className="space-y-2">
          <Label htmlFor="amount-received">Recibe ahora (opcional)</Label>
          <Input
            id="amount-received"
            type="number"
            inputMode="decimal"
            min={0.01}
            step="0.01"
            placeholder={total.toFixed(2)}
            value={amountReceived}
            onChange={(e) => setAmountReceived(e.target.value)}
          />
          <p className="text-[12px] text-[var(--fg-muted)]">
            Vacío cobra el total. Poné menos si el cliente abona una parte.
          </p>
        </div>
```

con su `useState('')`. El campo va **dentro del bloque que ya se muestra sólo
cuando `payNow`** (el modal usa `paymentTiming === 'now'`), y `total` ya está en
scope en la línea 207.

El submit **no arma el payload crudo**: pasa un DTO en camelCase. Son tres
archivos encadenados.

1. `apps/admin-v2/src/domain/repositories/service-log.repository.ts`, en
   `CreateServiceLogData` (línea 21), junto a `paymentStatus`:

```ts
  /** Abono al registrar. Ausente cobra el total, que es el comportamiento
      histórico. */
  amountReceived?: number;
```

2. `apps/admin-v2/src/infrastructure/api/repositories/api-service-log.repository.ts`,
   en `create()`, después de la línea de `payment_status` del objeto `body`:

```ts
    // Sólo si tiene valor: mandar null o 0 haría que el backend registre un
    // cobro de cero en vez de cobrar el total.
    if (data.amountReceived) {
      body.amount_received = data.amountReceived;
    }
```

   (va **fuera** del literal del objeto, junto al `if (data.items ...)` que ya
   está ahí abajo.)

3. `new-service-modal.tsx`, en el objeto que hoy manda `paymentStatus: payNow ? 'paid' : 'unpaid'`:

```tsx
        ...(payNow && amountReceived ? { amountReceived: Number(amountReceived) } : {}),
```

`paymentStatus` sigue siendo `'paid'` cuando se cobra ahora: significa «cobra al
registrar», y es `amount_received` el que decide si eso alcanza o queda en
`partial`.

- [ ] **Step 8: Typecheck and build**

Run: `cd apps/admin-v2 && npx tsc --noEmit && npm run build`
Expected: ambos verdes. Correlos hasta el final — un `tsc` cortado a la mitad es la forma habitual de romper el deploy de Vercel en este repo.

- [ ] **Step 9: Commit**

```bash
git add apps/admin-v2/src/domain/entities/service-log.ts \
        apps/admin-v2/src/infrastructure/api/repositories/api-service-log.repository.ts \
        apps/admin-v2/src/presentation/components/features/service-logs/ \
        "apps/admin-v2/src/presentation/app/(tenant)/service-log/page.tsx"
git commit -m "feat(abono): the counter can take part of the money and the row says how much is left"
```

---

### Task 6: Verificación de la fase

**Files:** ninguno. Es la corrida que decide si la fase se puede desplegar.

- [ ] **Step 1: Full backend suite**

Run: `cd apps/backend && composer test`
Expected: **exactamente los 9 fallos pre-existentes**. El verde sube de 458 a **477** (19 tests nuevos: 5 + 8 + 3 + 3). Anotá el número real.

- [ ] **Step 2: The reports suite against MySQL**

Run:
```bash
cd apps/backend
mysql -h127.0.0.1 -uroot -e "DROP DATABASE IF EXISTS turnly_test; CREATE DATABASE turnly_test;"
DB_CONNECTION=mysql DB_DATABASE=turnly_test php artisan migrate --force
DB_CONNECTION=mysql DB_DATABASE=turnly_test ./vendor/bin/pest tests/Feature/Report/ tests/Feature/Payment/
mysql -h127.0.0.1 -uroot -e "DROP DATABASE turnly_test;"
```
Expected: verde y **sin saltados** en `tests/Feature/Report/`.

- [ ] **Step 3: Admin builds**

Run: `cd apps/admin-v2 && npx tsc --noEmit && npm run build`
Expected: ambos verdes.

- [ ] **Step 4: The counter scene, end to end**

Con el stack levantado (`php artisan serve` en `apps/backend`, `npm run dev` en `apps/admin-v2`), en Registro Diario:

1. Registrá un servicio de **$30** con **Recibe ahora = $10**, efectivo.
2. La fila dice **`Abonado $10,00 · falta $20,00`** y el botón **Cobrar** sigue ahí.
3. **Facturar está deshabilitado** y al pasar el mouse dice que faltan $20.
4. El tile de EFECTIVO subió **$10**, no $30.
5. Si la caja está abierta, cerrala: el esperado incluye esos $10 y no $30.
6. Filtrá por **Abonado** → aparece. Filtrá por **Pendiente** → también aparece. Por **Pagado** → no.
7. Tocá **Cobrar**: el diálogo propone **$20,00**. Confirmá.
8. La fila pasa a **Efectivo**, **Facturar se habilita**, y el tile de EFECTIVO llega a **$30**.
9. Abrí el detalle del servicio: la bitácora muestra **dos** cobros, de $10 y $20, y el segundo dice que no quedaba saldo.

- [ ] **Step 5: The old path did not move**

Registrá un servicio normal, cobrando todo, **sin tocar «Recibe ahora»**. Tiene que comportarse exactamente como antes: pagado, facturable, un solo pago en el libro. Es el criterio de no-regresión de la fase.

- [ ] **Step 6: Report**

Contá qué pasó en cada paso, con el número de tests del paso 1 y las cifras de los tiles del paso 4.

---

## Notas de ejecución

**Rama.** Esta fase se apoya en las fases 1 y 2, que hoy viven sin desplegar en `feat/registro-bitacora-asignados`. Seguí en esa rama salvo que el usuario decida otra cosa.

**Lo que esta fase deliberadamente NO hace:**
- No muestra deuda de clientes ni permite cobrar contra un cliente. Eso es la fase 4.
- No agrega `left_owing` ni `manual_debts`. Fase 4.
- No toca el flujo de reservas: `payable_type = 'reservation'` sigue reservado y sin usar.
- No resuelve el **efectivo huérfano de la caja** (el aviso que desaparece al abrir la sesión). Está anotado en el spec como riesgo abierto; conviene decidirlo antes de la fase 4, porque un descuadre con dos causas posibles no se diagnostica.

**Si un total no cierra.** Casi siempre es un `payment_status === 'unpaid'` que quedó sin migrar a `!== 'paid'`. Buscalos con:

```bash
grep -rn "payment_status.*'unpaid'\|paymentStatus === 'unpaid'" apps/backend/app apps/admin-v2/src
```

Después de esta fase, cada resultado tiene que estar justificado por escrito o ser un bug.
