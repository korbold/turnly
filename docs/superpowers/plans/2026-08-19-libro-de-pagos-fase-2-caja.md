# Caja del día (libro de pagos, fase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Abrir una caja con una base, registrar egresos/retiros/ingresos contra ella, y cerrarla a ciegas contando el efectivo — para que el dueño sepa cada día si falta plata y cuánta.

**Architecture:** Dos tablas (`cash_sessions`, `cash_movements`) y un servicio de aplicación único (`CashRegister`) que hace toda la cuenta. El efectivo cobrado se ata a la sesión estampando `payments.cash_session_id` en el momento del cobro — no infiriendo por ventana de tiempo. El esperado **no se calcula ni se expone hasta el cierre**: mientras la sesión está abierta la columna es `NULL`, y esa es la implementación del cierre ciego.

**Tech Stack:** Laravel 13 (Domain → Application → Infrastructure), Pest + SQLite en memoria; Next.js 16 + React Query + shadcn/ui en `apps/admin-v2`.

**Spec:** `docs/superpowers/specs/2026-08-18-libro-de-pagos-caja-abono-deuda-design.md`, sección **Feature 1 — Caja del día**.

**Fase previa:** `docs/superpowers/plans/2026-08-18-libro-de-pagos-fase-1.md`, ya construida (commits `b7d15c8..510abdf`). Existen `payments`, `payment_allocations` y `App\Application\Services\PaymentLedger`.

## Global Constraints

- **El cierre es ciego.** Ningún endpoint devuelve el esperado mientras la sesión está abierta. `expected_amount` se escribe recién al cerrar. Si una pantalla muestra el esperado antes de que el cajero declare lo contado, es un defecto — el control se vuelve trámite.
- **La caja no bloquea el mostrador.** Se puede cobrar sin sesión abierta. `payments.cash_session_id` queda `NULL` y la tarjeta avisa. Trabar el cobro por un olvido de la mañana es peor que el descuadre.
- **Una sesión por día del negocio**, no por cajero: `unique(tenant_id, business_date)`.
- **Cerrada no se reabre.** No hay endpoint de reapertura. Un conteo mal hecho se corrige con un movimiento en la caja siguiente.
- **Sólo efectivo.** Tarjeta y transferencia no están en el cajón y no entran en la cuenta.
- **`amount` de un movimiento es siempre positivo.** El signo lo pone el `type`, no el número — un monto negativo con `type = expense` sumaría al cajón.
- Modelos en `app/Infrastructure/Persistence/Models/`, no en `app/Models/`. Todo modelo con tenant usa `use HasUuids, BelongsToTenant;`.
- Servicios de aplicación en `app/Application/Services/`.
- `config()` y no `env()` en código de aplicación (producción cachea config).
- Tests backend: `cd apps/backend && ./vendor/bin/pest <ruta>`.
- **La suite tiene 9 fallos PRE-EXISTENTES** (5 en `ClientResourceTest`, 3 en `ReservationInvoiceTest`, 1 en `ServiceLogTest > create service log requires required fields`). No son tuyos. No los arregles, no los cuentes como regresión. El total verde de partida es **418 passed**.
- **`php artisan migrate:fresh --seed` está roto de antes**: `TenantSeeder` inserta la columna `plan`, que la migración `2026_04_22_200100` eliminó. No lo arregles en esta fase; para probar migraciones desde cero usá `migrate:fresh` **sin** `--seed`.
- Admin: Next.js 16. Antes de escribir código de Next, leé la guía relevante en `apps/admin-v2/node_modules/next/dist/docs/`. Ver `apps/admin-v2/AGENTS.md`.
- **Nombres, ya decididos con el usuario:** la tira de tiles que hoy dice «Caja del día» pasa a llamarse **«Resumen del día»**; el nombre «Caja del día» queda para la tarjeta de la sesión de caja que crea esta fase.

---

### Task 1: Tablas y modelos de la caja

**Files:**
- Create: `apps/backend/database/migrations/2026_08_20_100001_create_cash_sessions_table.php`
- Create: `apps/backend/database/migrations/2026_08_20_100002_create_cash_movements_table.php`
- Create: `apps/backend/database/migrations/2026_08_20_100003_add_cash_session_id_to_payments.php`
- Create: `apps/backend/app/Infrastructure/Persistence/Models/CashSessionModel.php`
- Create: `apps/backend/app/Infrastructure/Persistence/Models/CashMovementModel.php`
- Test: `apps/backend/tests/Feature/Cash/CashModelTest.php`

**Interfaces:**
- Consumes: `payments` (fase 1).
- Produces:
  - `CashSessionModel` — `$fillable = ['tenant_id','business_date','opened_by','opened_at','opening_amount','closed_by','closed_at','counted_amount','expected_amount','difference','status','notes']`; constantes `STATUS_OPEN = 'open'`, `STATUS_CLOSED = 'closed'`; relaciones `movements()`, `opener()`, `closer()`; scope `scopeOpen()`.
  - `CashMovementModel` — `$fillable = ['tenant_id','cash_session_id','type','amount','reason','created_by']`; constantes `TYPE_EXPENSE = 'expense'`, `TYPE_WITHDRAWAL = 'withdrawal'`, `TYPE_DEPOSIT = 'deposit'`, y `TYPES = [expense, withdrawal, deposit]`; relación `session()`.
  - Columna `payments.cash_session_id` (uuid, nullable, FK a `cash_sessions` con `nullOnDelete`).

- [ ] **Step 1: Write the failing test**

```php
<?php
// apps/backend/tests/Feature/Cash/CashModelTest.php

use App\Infrastructure\Persistence\Models\CashMovementModel;
use App\Infrastructure\Persistence\Models\CashSessionModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Facades\Schema;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);
    $this->user = UserModel::factory()->create();

    $this->session = fn (array $attrs = []) => CashSessionModel::create(array_merge([
        'tenant_id'      => $this->tenant->id,
        'business_date'  => now()->toDateString(),
        'opened_by'      => $this->user->id,
        'opened_at'      => now(),
        'opening_amount' => 30.00,
        'status'         => CashSessionModel::STATUS_OPEN,
    ], $attrs));
});

test('a session records the base the owner handed over', function () {
    $s = ($this->session)();

    expect((float) $s->fresh()->opening_amount)->toBe(30.0);
    expect($s->status)->toBe('open');
    // El esperado no existe hasta el cierre: eso ES el cierre ciego.
    expect($s->expected_amount)->toBeNull();
});

test('a movement hangs off its session with a positive amount', function () {
    $s = ($this->session)();

    $m = CashMovementModel::create([
        'tenant_id'       => $this->tenant->id,
        'cash_session_id' => $s->id,
        'type'            => CashMovementModel::TYPE_EXPENSE,
        'amount'          => 4.50,
        'reason'          => 'Almuerzo',
        'created_by'      => $this->user->id,
    ]);

    expect((float) $m->fresh()->amount)->toBe(4.5);
    expect($s->fresh()->movements)->toHaveCount(1);
});

test('a tenant cannot have two sessions for the same business day', function () {
    // Una caja por día del negocio. Sin esto, abrir dos veces por la mañana
    // parte la recaudación en dos cajones que nadie cuadra.
    ($this->session)();

    expect(fn () => ($this->session)())
        ->toThrow(Illuminate\Database\QueryException::class);
});

test('the open scope only returns sessions still open', function () {
    ($this->session)(['business_date' => now()->subDay()->toDateString(), 'status' => CashSessionModel::STATUS_CLOSED]);
    $abierta = ($this->session)();

    expect(CashSessionModel::open()->pluck('id')->all())->toBe([$abierta->id]);
});

test('the tenant scope hides another tenants cash', function () {
    $otro = TenantModel::factory()->create(['status' => 'active']);
    CashSessionModel::create([
        'tenant_id' => $otro->id, 'business_date' => now()->toDateString(),
        'opened_by' => $this->user->id, 'opened_at' => now(),
        'opening_amount' => 99.00, 'status' => CashSessionModel::STATUS_OPEN,
    ]);
    ($this->session)();

    expect(CashSessionModel::count())->toBe(1);
    expect((float) CashSessionModel::first()->opening_amount)->toBe(30.0);
});

test('a payment can point at the session it was collected in', function () {
    expect(Schema::hasColumn('payments', 'cash_session_id'))->toBeTrue();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Cash/CashModelTest.php`
Expected: FAIL — `Class "App\Infrastructure\Persistence\Models\CashSessionModel" not found`

- [ ] **Step 3: Write the cash_sessions migration**

```php
<?php
// apps/backend/database/migrations/2026_08_20_100001_create_cash_sessions_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * La caja del día: una base al abrir, un conteo al cerrar, y la
     * diferencia entre lo contado y lo que el sistema esperaba.
     *
     * `expected_amount` y `difference` nacen NULL y se escriben recién al
     * cerrar. No es pereza: es el cierre ciego. Si el esperado estuviera
     * disponible mientras la caja está abierta, el cajero escribiría ese
     * número en el conteo y el control sería teatro.
     *
     * `status` es string y no enum por la misma razón que `payment_status`
     * en la fase 1: SQLite (los tests) no sabe alterar enums.
     */
    public function up(): void
    {
        Schema::create('cash_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            // El día del negocio, no el timestamp: una caja abierta 08:12 y
            // cerrada 21:40 es una sola cosa, y "la caja del lunes" tiene que
            // poder buscarse por esa fecha.
            $table->date('business_date');

            $table->uuid('opened_by')->nullable();
            $table->timestamp('opened_at');
            $table->decimal('opening_amount', 12, 2)->default(0);

            $table->uuid('closed_by')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->decimal('counted_amount', 12, 2)->nullable();
            $table->decimal('expected_amount', 12, 2)->nullable();
            $table->decimal('difference', 12, 2)->nullable();

            $table->string('status', 10)->default('open');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->foreign('opened_by')->references('id')->on('users')->nullOnDelete();
            $table->foreign('closed_by')->references('id')->on('users')->nullOnDelete();

            // Una caja por día del negocio. Es la regla del spec, y en la base
            // en vez de sólo en el servicio porque dos pestañas abiertas a la
            // vez son el caso real.
            $table->unique(['tenant_id', 'business_date']);
            $table->index(['tenant_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cash_sessions');
    }
};
```

- [ ] **Step 4: Write the cash_movements migration**

```php
<?php
// apps/backend/database/migrations/2026_08_20_100002_create_cash_movements_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Plata que entra o sale del cajón sin ser un cobro.
     *
     * Tres tipos en una tabla con enum, no tres tablas: `expense` es un gasto
     * (almuerzo, insumos), `withdrawal` es el dueño llevándose la recaudación
     * — sale del cajón pero NO es un gasto, y mezclarlos ensucia cualquier
     * reporte de gastos futuro con cifras que no lo son — y `deposit` es el
     * espejo, reposición de cambio.
     *
     * `amount` es siempre positivo; el signo lo pone `type`.
     */
    public function up(): void
    {
        Schema::create('cash_movements', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('cash_session_id');
            $table->string('type', 12);
            $table->decimal('amount', 12, 2);
            $table->string('reason', 200);
            $table->uuid('created_by')->nullable();
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->foreign('cash_session_id')->references('id')->on('cash_sessions')->cascadeOnDelete();
            $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();

            $table->index(['cash_session_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cash_movements');
    }
};
```

- [ ] **Step 5: Write the payments column migration**

```php
<?php
// apps/backend/database/migrations/2026_08_20_100003_add_cash_session_id_to_payments.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * La fase 1 dejó esta columna afuera a propósito: su FK apunta a
     * `cash_sessions`, que no existía. Ahora sí.
     *
     * Nullable y sin backfill: los pagos históricos no pertenecen a ninguna
     * sesión porque no había sesiones, y un cobro hecho hoy sin caja abierta
     * tampoco — la caja no bloquea el mostrador.
     */
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->uuid('cash_session_id')->nullable()->after('received_by');
            $table->foreign('cash_session_id')->references('id')->on('cash_sessions')->nullOnDelete();
            $table->index(['cash_session_id', 'method']);
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropForeign(['cash_session_id']);
            $table->dropIndex(['cash_session_id', 'method']);
            $table->dropColumn('cash_session_id');
        });
    }
};
```

- [ ] **Step 6: Write the models**

```php
<?php
// apps/backend/app/Infrastructure/Persistence/Models/CashSessionModel.php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Models;

use App\Infrastructure\Persistence\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * La caja de un día. Ver el spec: es el primer consumidor del libro de pagos
 * y la feature que prueba que el libro está bien — si el arqueo cuadra una
 * semana seguida, el cimiento es sólido.
 */
class CashSessionModel extends Model
{
    use HasUuids, BelongsToTenant;

    protected $table = 'cash_sessions';

    public const STATUS_OPEN   = 'open';
    public const STATUS_CLOSED = 'closed';

    protected $fillable = [
        'tenant_id', 'business_date',
        'opened_by', 'opened_at', 'opening_amount',
        'closed_by', 'closed_at', 'counted_amount', 'expected_amount', 'difference',
        'status', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'business_date'   => 'date',
            'opened_at'       => 'datetime',
            'closed_at'       => 'datetime',
            'opening_amount'  => 'decimal:2',
            'counted_amount'  => 'decimal:2',
            'expected_amount' => 'decimal:2',
            'difference'      => 'decimal:2',
        ];
    }

    public function scopeOpen(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_OPEN);
    }

    public function movements(): HasMany
    {
        return $this->hasMany(CashMovementModel::class, 'cash_session_id');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(PaymentModel::class, 'cash_session_id');
    }

    public function opener(): BelongsTo
    {
        return $this->belongsTo(UserModel::class, 'opened_by');
    }

    public function closer(): BelongsTo
    {
        return $this->belongsTo(UserModel::class, 'closed_by');
    }

    public function isOpen(): bool
    {
        return $this->status === self::STATUS_OPEN;
    }
}
```

```php
<?php
// apps/backend/app/Infrastructure/Persistence/Models/CashMovementModel.php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Models;

use App\Infrastructure\Persistence\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Plata que entra o sale del cajón sin ser un cobro. */
class CashMovementModel extends Model
{
    use HasUuids, BelongsToTenant;

    protected $table = 'cash_movements';

    /** Gasto: almuerzo, insumos. Sale del cajón y es un gasto real. */
    public const TYPE_EXPENSE = 'expense';
    /** Retiro: el dueño se lleva la recaudación. Sale, pero no es un gasto. */
    public const TYPE_WITHDRAWAL = 'withdrawal';
    /** Ingreso: reposición de cambio. Entra sin ser un cobro. */
    public const TYPE_DEPOSIT = 'deposit';

    public const TYPES = [self::TYPE_EXPENSE, self::TYPE_WITHDRAWAL, self::TYPE_DEPOSIT];

    protected $fillable = [
        'tenant_id', 'cash_session_id', 'type', 'amount', 'reason', 'created_by',
    ];

    protected function casts(): array
    {
        return ['amount' => 'decimal:2'];
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(CashSessionModel::class, 'cash_session_id');
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(UserModel::class, 'created_by');
    }
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Cash/CashModelTest.php`
Expected: PASS — 6 passed

- [ ] **Step 8: Verify the migrations run on MySQL**

Run: `cd apps/backend && php artisan migrate`
Expected: las tres migraciones corren limpias. La FK de `payments.cash_session_id` es la que puede fallar si el orden de archivos no es el correcto — `cash_sessions` tiene que existir antes.

- [ ] **Step 9: Commit**

```bash
git add apps/backend/database/migrations/2026_08_20_1000*.php \
        apps/backend/app/Infrastructure/Persistence/Models/CashSessionModel.php \
        apps/backend/app/Infrastructure/Persistence/Models/CashMovementModel.php \
        apps/backend/tests/Feature/Cash/CashModelTest.php
git commit -m "feat(caja): a day's cash drawer, with the expected amount deliberately absent until close"
```

---

### Task 2: `CashRegister`, la cuenta en un solo lugar

**Files:**
- Create: `apps/backend/app/Domain/Cash/CashRegisterException.php`
- Create: `apps/backend/app/Application/Services/CashRegister.php`
- Test: `apps/backend/tests/Feature/Cash/CashRegisterTest.php`

**Interfaces:**
- Consumes: `CashSessionModel`, `CashMovementModel` (Task 1), `PaymentModel` (fase 1).
- Produces:

```php
// App\Domain\Cash\CashRegisterException extends \RuntimeException
public readonly string $errorCode;   // ALREADY_OPEN | PREVIOUS_SESSION_OPEN | SESSION_CLOSED | INVALID_TYPE
public static function alreadyOpen(string $date): self
public static function previousSessionOpen(string $date): self
public static function sessionClosed(): self
public static function invalidType(string $type): self

// App\Application\Services\CashRegister
public function currentSession(string $tenantId): ?CashSessionModel
public function sessionFor(string $tenantId, string $businessDate): ?CashSessionModel
public function openSession(string $tenantId, string $businessDate, float $openingAmount, ?string $userId): CashSessionModel
public function addMovement(CashSessionModel $session, string $type, float $amount, string $reason, ?string $userId): CashMovementModel
public function expectedFor(CashSessionModel $session): float
public function closeSession(CashSessionModel $session, float $countedAmount, ?string $userId, ?string $notes = null): CashSessionModel
public function cashCollectedWithoutSession(string $tenantId, string $businessDate): float
```

`expectedFor()` es público porque el cierre lo necesita y los tests lo prueban directo — pero **ningún endpoint lo expone mientras la sesión está abierta**. Ver las Global Constraints.

- [ ] **Step 1: Write the failing test**

```php
<?php
// apps/backend/tests/Feature/Cash/CashRegisterTest.php

use App\Application\Services\CashRegister;
use App\Application\Services\PaymentLedger;
use App\Domain\Cash\CashRegisterException;
use App\Infrastructure\Persistence\Models\CashMovementModel;
use App\Infrastructure\Persistence\Models\CashSessionModel;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    $this->user = UserModel::factory()->create();
    $service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->user->id, 'type' => 'sedan',
    ]);

    $this->log = fn (float $price) => ServiceLogModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $resource->id,
        'service_id' => $service->id,
        'attended_by' => $this->user->id,
        'created_by' => $this->user->id,
        'price_charged' => $price,
        'payment_status' => 'unpaid',
        'paid_at' => null,
        'payment_method' => null,
        'log_date' => now()->toDateString(),
    ]);

    $this->caja   = app(CashRegister::class);
    $this->ledger = app(PaymentLedger::class);
    $this->hoy    = now()->toDateString();

    $this->abrir = fn (float $base = 30.00, ?string $date = null) =>
        $this->caja->openSession($this->tenant->id, $date ?? $this->hoy, $base, $this->user->id);
});

test('opening a session records the base and leaves it open', function () {
    $s = ($this->abrir)(30.00);

    expect($s->status)->toBe('open');
    expect((float) $s->opening_amount)->toBe(30.0);
    expect($this->caja->currentSession($this->tenant->id)->id)->toBe($s->id);
});

test('a second session for the same day is refused', function () {
    ($this->abrir)();

    expect(fn () => ($this->abrir)())
        ->toThrow(CashRegisterException::class);
});

test('yesterdays open session blocks today and names its date', function () {
    // "La caja de ayer no se cierra sola: nadie contó esa plata a medianoche."
    $ayer = now()->subDay()->toDateString();
    ($this->abrir)(30.00, $ayer);

    try {
        ($this->abrir)(30.00, $this->hoy);
        $this->fail('esperaba CashRegisterException');
    } catch (CashRegisterException $e) {
        expect($e->errorCode)->toBe('PREVIOUS_SESSION_OPEN');
        expect($e->getMessage())->toContain($ayer);
    }
});

test('the expected amount is base plus cash collected in the session', function () {
    $s = ($this->abrir)(30.00);
    $this->ledger->recordForServiceLog(($this->log)(15.00), 15.00, 'cash', null, $this->user->id);

    expect($this->caja->expectedFor($s->fresh()))->toBe(45.0);
});

test('card and transfer never touch the drawer', function () {
    $s = ($this->abrir)(30.00);
    $this->ledger->recordForServiceLog(($this->log)(50.00), 50.00, 'card', null, $this->user->id);
    $this->ledger->recordForServiceLog(($this->log)(20.00), 20.00, 'transfer', 'pichincha', $this->user->id);

    expect($this->caja->expectedFor($s->fresh()))->toBe(30.0);
});

test('movements move the expected amount in the direction their type says', function () {
    $s = ($this->abrir)(100.00);

    $this->caja->addMovement($s, CashMovementModel::TYPE_EXPENSE, 10.00, 'Almuerzo', $this->user->id);
    $this->caja->addMovement($s, CashMovementModel::TYPE_WITHDRAWAL, 40.00, 'Retiro del dueño', $this->user->id);
    $this->caja->addMovement($s, CashMovementModel::TYPE_DEPOSIT, 5.00, 'Cambio', $this->user->id);

    // 100 − 10 − 40 + 5
    expect($this->caja->expectedFor($s->fresh()))->toBe(55.0);
});

test('an unknown movement type is refused', function () {
    $s = ($this->abrir)();

    expect(fn () => $this->caja->addMovement($s, 'propina', 5.00, 'x', $this->user->id))
        ->toThrow(CashRegisterException::class);
});

test('closing freezes counted, expected and the difference', function () {
    $s = ($this->abrir)(30.00);
    $this->ledger->recordForServiceLog(($this->log)(20.00), 20.00, 'cash', null, $this->user->id);

    $cerrada = $this->caja->closeSession($s->fresh(), 48.00, $this->user->id, 'faltó un billete');

    expect($cerrada->status)->toBe('closed');
    expect((float) $cerrada->counted_amount)->toBe(48.0);
    expect((float) $cerrada->expected_amount)->toBe(50.0);
    expect((float) $cerrada->difference)->toBe(-2.0);
    expect($cerrada->closed_by)->toBe($this->user->id);
    expect($cerrada->closed_at)->not->toBeNull();
});

test('a surplus is a positive difference', function () {
    $s = ($this->abrir)(30.00);

    $cerrada = $this->caja->closeSession($s, 33.00, $this->user->id);

    expect((float) $cerrada->difference)->toBe(3.0);
});

test('a closed session cannot be closed again', function () {
    // "Cerrada no se reabre": tampoco se re-cierra con otro conteo.
    $s = ($this->abrir)();
    $this->caja->closeSession($s, 30.00, $this->user->id);

    expect(fn () => $this->caja->closeSession($s->fresh(), 99.00, $this->user->id))
        ->toThrow(CashRegisterException::class);
});

test('a closed session takes no more movements', function () {
    $s = ($this->abrir)();
    $this->caja->closeSession($s, 30.00, $this->user->id);

    expect(fn () => $this->caja->addMovement($s->fresh(), CashMovementModel::TYPE_EXPENSE, 1.00, 'x', $this->user->id))
        ->toThrow(CashRegisterException::class);
});

test('cash collected with no session open is reported, not swallowed', function () {
    // La caja no bloquea el mostrador, pero el efectivo huérfano tiene que
    // ser visible o la pantalla miente por omisión.
    $this->ledger->recordForServiceLog(($this->log)(12.00), 12.00, 'cash', null, $this->user->id);

    expect($this->caja->cashCollectedWithoutSession($this->tenant->id, $this->hoy))->toBe(12.0);
});

test('cash collected inside a session is not counted as orphan', function () {
    ($this->abrir)();
    $this->ledger->recordForServiceLog(($this->log)(12.00), 12.00, 'cash', null, $this->user->id);

    expect($this->caja->cashCollectedWithoutSession($this->tenant->id, $this->hoy))->toBe(0.0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Cash/CashRegisterTest.php`
Expected: FAIL — `Class "App\Application\Services\CashRegister" not found`

Nota: dos de estos tests (`the expected amount is base plus cash collected` y `cash collected inside a session is not counted as orphan`) sólo pasan una vez que la Task 3 estampe `cash_session_id` en el pago. Si al terminar la Task 2 quedan en rojo **por esa razón exacta**, seguí a la Task 3 y volvé a correr — no cambies el test.

- [ ] **Step 3: Write the exception**

```php
<?php
// apps/backend/app/Domain/Cash/CashRegisterException.php

declare(strict_types=1);

namespace App\Domain\Cash;

use RuntimeException;

/**
 * Las reglas de la caja son del dominio, no del controlador: el mismo "no
 * podés abrir dos veces" tiene que valer si mañana la caja se abre desde un
 * comando o desde la app móvil. El controlador traduce `errorCode` a JSON.
 */
class CashRegisterException extends RuntimeException
{
    public function __construct(public readonly string $errorCode, string $message)
    {
        parent::__construct($message);
    }

    public static function alreadyOpen(string $date): self
    {
        return new self('ALREADY_OPEN', "Ya hay una caja abierta para el {$date}.");
    }

    public static function previousSessionOpen(string $date): self
    {
        return new self(
            'PREVIOUS_SESSION_OPEN',
            "La caja del {$date} sigue abierta. Cerrala antes de abrir la de hoy."
        );
    }

    public static function sessionClosed(): self
    {
        return new self('SESSION_CLOSED', 'Esta caja ya está cerrada y no se puede modificar.');
    }

    public static function invalidType(string $type): self
    {
        return new self('INVALID_TYPE', "Tipo de movimiento desconocido: {$type}.");
    }
}
```

- [ ] **Step 4: Write the service**

```php
<?php
// apps/backend/app/Application/Services/CashRegister.php

declare(strict_types=1);

namespace App\Application\Services;

use App\Domain\Cash\CashRegisterException;
use App\Infrastructure\Persistence\Models\CashMovementModel;
use App\Infrastructure\Persistence\Models\CashSessionModel;
use App\Infrastructure\Persistence\Models\PaymentModel;
use Illuminate\Support\Facades\DB;

/**
 * La caja del día, en un solo lugar.
 *
 * La cuenta vive acá y no en el controlador porque el arqueo es la única
 * cifra de todo el sistema que un dueño compara contra billetes de verdad:
 * si dos pantallas la calculan distinto, una de las dos le va a decir que le
 * robaron.
 *
 *     esperado = apertura
 *              + pagos en efectivo de la sesión
 *              + ingresos
 *              − egresos
 *              − retiros
 *
 * Sólo efectivo: tarjeta y transferencia no están en el cajón.
 */
class CashRegister
{
    public function currentSession(string $tenantId): ?CashSessionModel
    {
        return CashSessionModel::query()
            ->forTenant($tenantId)
            ->open()
            ->orderBy('business_date')
            ->first();
    }

    public function sessionFor(string $tenantId, string $businessDate): ?CashSessionModel
    {
        return CashSessionModel::query()
            ->forTenant($tenantId)
            ->whereDate('business_date', $businessDate)
            ->first();
    }

    /**
     * Abrir exige que no quede ninguna caja abierta, ni de hoy ni de antes.
     * La de ayer no se cierra sola: nadie contó esa plata a medianoche, y
     * cerrarla automáticamente con el esperado sería inventar un conteo.
     */
    public function openSession(
        string $tenantId,
        string $businessDate,
        float $openingAmount,
        ?string $userId,
    ): CashSessionModel {
        $abierta = $this->currentSession($tenantId);

        if ($abierta !== null) {
            $suFecha = $abierta->business_date->toDateString();

            throw $suFecha === $businessDate
                ? CashRegisterException::alreadyOpen($suFecha)
                : CashRegisterException::previousSessionOpen($suFecha);
        }

        if ($this->sessionFor($tenantId, $businessDate) !== null) {
            // Ya hubo una caja ese día y se cerró. Cerrada no se reabre.
            throw CashRegisterException::alreadyOpen($businessDate);
        }

        return CashSessionModel::create([
            'tenant_id'      => $tenantId,
            'business_date'  => $businessDate,
            'opened_by'      => $userId,
            'opened_at'      => now(),
            'opening_amount' => $openingAmount,
            'status'         => CashSessionModel::STATUS_OPEN,
        ]);
    }

    public function addMovement(
        CashSessionModel $session,
        string $type,
        float $amount,
        string $reason,
        ?string $userId,
    ): CashMovementModel {
        if (!$session->isOpen()) {
            throw CashRegisterException::sessionClosed();
        }

        if (!in_array($type, CashMovementModel::TYPES, true)) {
            throw CashRegisterException::invalidType($type);
        }

        return CashMovementModel::create([
            'tenant_id'       => $session->tenant_id,
            'cash_session_id' => $session->id,
            'type'            => $type,
            // Siempre positivo: el signo lo pone el tipo. Un egreso de −10
            // sumaría al cajón, que es exactamente el error que este abs()
            // hace imposible.
            'amount'          => abs($amount),
            'reason'          => $reason,
            'created_by'      => $userId,
        ]);
    }

    public function expectedFor(CashSessionModel $session): float
    {
        $efectivo = (float) PaymentModel::query()
            ->forTenant($session->tenant_id)
            ->where('cash_session_id', $session->id)
            ->where('method', 'cash')
            ->sum('amount');

        $porTipo = fn (string $type) => (float) CashMovementModel::query()
            ->forTenant($session->tenant_id)
            ->where('cash_session_id', $session->id)
            ->where('type', $type)
            ->sum('amount');

        return round(
            (float) $session->opening_amount
            + $efectivo
            + $porTipo(CashMovementModel::TYPE_DEPOSIT)
            - $porTipo(CashMovementModel::TYPE_EXPENSE)
            - $porTipo(CashMovementModel::TYPE_WITHDRAWAL),
            2,
        );
    }

    /**
     * El conteo del cajero entra primero; recién entonces se calcula y se
     * congela el esperado. Los tres números quedan escritos en la fila: son
     * un hecho de ese día, y recalcularlos después con pagos que llegaron
     * tarde reescribiría la historia.
     */
    public function closeSession(
        CashSessionModel $session,
        float $countedAmount,
        ?string $userId,
        ?string $notes = null,
    ): CashSessionModel {
        if (!$session->isOpen()) {
            throw CashRegisterException::sessionClosed();
        }

        return DB::transaction(function () use ($session, $countedAmount, $userId, $notes) {
            $esperado = $this->expectedFor($session);

            $session->forceFill([
                'counted_amount'  => $countedAmount,
                'expected_amount' => $esperado,
                'difference'      => round($countedAmount - $esperado, 2),
                'closed_by'       => $userId,
                'closed_at'       => now(),
                'status'          => CashSessionModel::STATUS_CLOSED,
                'notes'           => $notes,
            ])->save();

            return $session->fresh();
        });
    }

    /**
     * Efectivo cobrado ese día que no cayó en ninguna caja. No bloquea nada:
     * es el número que la tarjeta muestra cuando alguien cobró antes de abrir.
     */
    public function cashCollectedWithoutSession(string $tenantId, string $businessDate): float
    {
        return (float) PaymentModel::query()
            ->forTenant($tenantId)
            ->whereNull('cash_session_id')
            ->where('method', 'cash')
            ->whereDate('paid_at', $businessDate)
            ->sum('amount');
    }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Cash/CashRegisterTest.php`
Expected: 11 passed, 2 failed — los dos que dependen de que el pago traiga `cash_session_id`, que llega en la Task 3. Si falla algún otro, pará y diagnosticá.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/app/Domain/Cash/CashRegisterException.php \
        apps/backend/app/Application/Services/CashRegister.php \
        apps/backend/tests/Feature/Cash/CashRegisterTest.php
git commit -m "feat(caja): the arqueo lives in one place, because it is the number compared against real bills"
```

---

### Task 3: El cobro cae en la caja abierta

**Files:**
- Modify: `apps/backend/app/Application/Services/PaymentLedger.php` (`recordForServiceLog`)
- Test: `apps/backend/tests/Feature/Cash/CashStampingTest.php`

**Interfaces:**
- Consumes: `CashRegister::currentSession()` (Task 2).
- Produces: `payments.cash_session_id` poblado en cada cobro hecho con una caja abierta.

**Contexto:** `PaymentLedger::recordForServiceLog()` arma el `PaymentModel::create([...])` dentro de un `DB::transaction`. Hoy no conoce la caja. Se le inyecta `CashRegister` por constructor — el ledger no tiene constructor todavía, hay que agregarlo.

**Por qué estampar y no inferir:** el spec lo decidió explícitamente. Una ventana de tiempo falla en los bordes reales — la caja se abre tarde, el pago entra 23:58 — y ese borde es justo el día que el dueño revisa.

- [ ] **Step 1: Write the failing test**

```php
<?php
// apps/backend/tests/Feature/Cash/CashStampingTest.php

use App\Application\Services\CashRegister;
use App\Application\Services\PaymentLedger;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    $this->user = UserModel::factory()->create();
    $service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->user->id, 'type' => 'sedan',
    ]);

    $this->log = fn (float $price = 10.00) => ServiceLogModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $resource->id,
        'service_id' => $service->id,
        'attended_by' => $this->user->id,
        'created_by' => $this->user->id,
        'price_charged' => $price,
        'payment_status' => 'unpaid',
        'paid_at' => null,
        'payment_method' => null,
        'log_date' => now()->toDateString(),
    ]);

    $this->caja   = app(CashRegister::class);
    $this->ledger = app(PaymentLedger::class);
});

test('a payment made with a session open belongs to it', function () {
    $s = $this->caja->openSession($this->tenant->id, now()->toDateString(), 20.00, $this->user->id);

    $p = $this->ledger->recordForServiceLog(($this->log)(), 10.00, 'cash', null, $this->user->id);

    expect($p->cash_session_id)->toBe($s->id);
});

test('a payment made with no session open belongs to none', function () {
    // La caja no bloquea el mostrador.
    $p = $this->ledger->recordForServiceLog(($this->log)(), 10.00, 'cash', null, $this->user->id);

    expect($p->cash_session_id)->toBeNull();
});

test('a card payment still gets stamped, so the session knows what it did not hold', function () {
    // Se estampa igual aunque no sea efectivo: la sesión es el contexto del
    // cobro, no sólo el cajón. `expectedFor` ya filtra por method = cash.
    $s = $this->caja->openSession($this->tenant->id, now()->toDateString(), 0.00, $this->user->id);

    $p = $this->ledger->recordForServiceLog(($this->log)(), 10.00, 'card', null, $this->user->id);

    expect($p->cash_session_id)->toBe($s->id);
    expect($this->caja->expectedFor($s->fresh()))->toBe(0.0);
});

test('a payment does not fall into yesterdays still-open session by accident', function () {
    // Si la caja de ayer quedó abierta, el cobro de hoy cae ahí — y está
    // bien: es la única caja abierta, y por eso el sistema exige cerrarla
    // antes de abrir la de hoy. Este test fija ese comportamiento para que
    // nadie lo "arregle" silenciosamente.
    $ayer = $this->caja->openSession(
        $this->tenant->id, now()->subDay()->toDateString(), 0.00, $this->user->id
    );

    $p = $this->ledger->recordForServiceLog(($this->log)(), 10.00, 'cash', null, $this->user->id);

    expect($p->cash_session_id)->toBe($ayer->id);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Cash/CashStampingTest.php`
Expected: FAIL — `cash_session_id` es `null` en el primer test.

- [ ] **Step 3: Inject the register into the ledger**

En `apps/backend/app/Application/Services/PaymentLedger.php`, agregá el
constructor arriba de `recordForServiceLog`:

```php
    public function __construct(private CashRegister $cash) {}
```

No hace falta ningún `use`: `CashRegister` vive en el mismo namespace
(`App\Application\Services`). El import de `CashSessionModel` va en
`PaymentModel`, no acá — ver el Step 5.

- [ ] **Step 4: Stamp the session on the payment**

Dentro del `DB::transaction` de `recordForServiceLog`, reemplazá el
`PaymentModel::create([...])` por esta versión — cambia una sola clave:

```php
            // La caja abierta es el contexto del cobro. Se estampa acá y no
            // se infiere después por ventana de tiempo: la caja que se abre
            // tarde y el pago de las 23:58 son los bordes reales, y son
            // justo los días que el dueño revisa.
            $sesion = $this->cash->currentSession($log->tenant_id);

            $payment = PaymentModel::create([
                'tenant_id'       => $log->tenant_id,
                'client_id'       => $log->clientResource?->client_id,
                'amount'          => $amount,
                'method'          => $method,
                'bank'            => $method === 'transfer' ? $bank : null,
                'paid_at'         => $paidAt ?? now(),
                'received_by'     => $receivedBy,
                'cash_session_id' => $sesion?->id,
                'notes'           => $notes,
            ]);
```

- [ ] **Step 5: Add the column to the model's fillable**

En `apps/backend/app/Infrastructure/Persistence/Models/PaymentModel.php`,
`$fillable` pasa a:

```php
    protected $fillable = [
        'tenant_id', 'client_id', 'amount', 'method', 'bank',
        'paid_at', 'received_by', 'cash_session_id', 'notes',
    ];
```

y agregá la relación al final de la clase. `CashSessionModel` está en el mismo
namespace que `PaymentModel`, así que no necesita import; `BelongsTo` ya está
importado desde la fase 1:

```php
    public function cashSession(): BelongsTo
    {
        return $this->belongsTo(CashSessionModel::class, 'cash_session_id');
    }
```

- [ ] **Step 6: Run the cash tests**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Cash/`
Expected: PASS — 23 passed (6 + 13 + 4). Los dos de `CashRegisterTest` que la Task 2 dejó rojos ahora pasan.

- [ ] **Step 7: Run every payment and service-log test**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Payment/ tests/Feature/ServiceLog/`
Expected: sólo el fallo pre-existente `ServiceLogTest > create service log requires required fields`. Si rompe otro, es que inyectar el constructor cambió cómo se resuelve `PaymentLedger` en algún lado — diagnosticá, no edites el assert.

- [ ] **Step 8: Commit**

```bash
git add apps/backend/app/Application/Services/PaymentLedger.php \
        apps/backend/app/Infrastructure/Persistence/Models/PaymentModel.php \
        apps/backend/tests/Feature/Cash/CashStampingTest.php
git commit -m "feat(caja): stamp the open session on the payment instead of guessing it later"
```

---

### Task 4: El privilegio Caja

**Files:**
- Modify: `apps/backend/app/Domain/Tenant/StaffPrivileges.php`
- Modify: `apps/admin-v2/src/shared/constants/permissions.ts`
- Modify: `apps/admin-v2/src/presentation/hooks/use-permissions.ts`
- Test: `apps/backend/tests/Feature/Cash/CashPrivilegeTest.php`

**Interfaces:**
- Consumes: nada.
- Produces: `StaffPrivileges::CASH = 'Caja'` (backend) y `canManageCash: boolean` en el retorno de `usePermissions()` (admin).

**Defaults, distintos de los otros privilegios:** `Admin` y **`Cajero`** en `full`, `Lavador` y `Cliente` en `none`. Precio y Eliminar arrancan Admin-only porque mueven plata hacia afuera; abrir y cerrar la caja **es el trabajo del cajero**, y un default en `none` haría que la feature no funcione el día que se despliega.

- [ ] **Step 1: Write the failing test**

```php
<?php
// apps/backend/tests/Feature/Cash/CashPrivilegeTest.php

use App\Domain\Tenant\StaffPrivileges;

test('the cashier may work the drawer by default', function () {
    // A diferencia de Precio y Eliminar: abrir y cerrar la caja ES el trabajo
    // del cajero. Un default en 'none' desplegaría la feature apagada.
    expect(StaffPrivileges::granted('cashier', StaffPrivileges::CASH, []))->toBeTrue();
});

test('the admin may work the drawer by default', function () {
    expect(StaffPrivileges::granted('tenant_admin', StaffPrivileges::CASH, []))->toBeTrue();
});

test('the washer may not', function () {
    expect(StaffPrivileges::granted('washer', StaffPrivileges::CASH, []))->toBeFalse();
});

test('the owner is never gated out of their own drawer', function () {
    expect(StaffPrivileges::granted('owner', StaffPrivileges::CASH, ['Admin' => ['Caja' => 'none']]))
        ->toBeTrue();
});

test('the matrix can take the drawer away from the cashier', function () {
    expect(StaffPrivileges::granted('cashier', StaffPrivileges::CASH, ['Cajero' => ['Caja' => 'none']]))
        ->toBeFalse();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Cash/CashPrivilegeTest.php`
Expected: FAIL — `Undefined constant App\Domain\Tenant\StaffPrivileges::CASH`

- [ ] **Step 3: Add the privilege to the backend matrix**

En `apps/backend/app/Domain/Tenant/StaffPrivileges.php`, agregá la constante
junto a las otras tres:

```php
    public const ASSIGNEES = 'Asignados';
    /** Abrir la caja, mover plata dentro de ella y cerrarla. */
    public const CASH      = 'Caja';
```

y agregá la clave a las cuatro filas de `DEFAULTS`, dejando el resto igual:

```php
    private const DEFAULTS = [
        'Admin'   => [self::PRICE => 'full', self::DELETE => 'full', self::ASSIGNEES => 'full', self::CASH => 'full'],
        // Caja arranca en 'full' para el cajero, al revés que Precio y
        // Eliminar: abrir y cerrar el cajón es su trabajo, y un default en
        // 'none' desplegaría la feature apagada para quien la usa.
        'Cajero'  => [self::PRICE => 'none', self::DELETE => 'none', self::ASSIGNEES => 'full', self::CASH => 'full'],
        'Lavador' => [self::PRICE => 'none', self::DELETE => 'none', self::ASSIGNEES => 'none', self::CASH => 'none'],
        'Cliente' => [self::PRICE => 'none', self::DELETE => 'none', self::ASSIGNEES => 'none', self::CASH => 'none'],
    ];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Cash/CashPrivilegeTest.php`
Expected: PASS — 5 passed

- [ ] **Step 5: Mirror it in the admin**

En `apps/admin-v2/src/shared/constants/permissions.ts`:

```ts
export const PRIVILEGES = ['Precio', 'Eliminar', 'Asignados', 'Caja'] as const;
```

y agregá `Caja` a las cuatro filas de `DEFAULT_PERMISSIONS`, en la misma línea
que los otros privilegios:

```ts
  Admin: {
    // …secciones sin cambios…
    Precio: 'full', Eliminar: 'full', Asignados: 'full', Caja: 'full',
  },
  Cajero: {
    // …secciones sin cambios…
    Precio: 'none', Eliminar: 'none', Asignados: 'full', Caja: 'full',
  },
  Lavador: {
    // …secciones sin cambios…
    Precio: 'none', Eliminar: 'none', Asignados: 'none', Caja: 'none',
  },
  Cliente: {
    // …secciones sin cambios…
    Precio: 'none', Eliminar: 'none', Asignados: 'none', Caja: 'none',
  },
```

En `apps/admin-v2/src/presentation/hooks/use-permissions.ts`, agregá al objeto
que devuelve `usePermissions()`, junto a `canSetPrice` y `canDeleteLog`:

```ts
    canManageCash: hasPrivilege('Caja'),
```

- [ ] **Step 6: Typecheck the admin**

Run: `cd apps/admin-v2 && npx tsc --noEmit`
Expected: sin errores. Correlo hasta el final — un `tsc` cortado a la mitad es la forma más común de romper el build de Vercel en este repo.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/app/Domain/Tenant/StaffPrivileges.php \
        apps/backend/tests/Feature/Cash/CashPrivilegeTest.php \
        apps/admin-v2/src/shared/constants/permissions.ts \
        apps/admin-v2/src/presentation/hooks/use-permissions.ts
git commit -m "feat(caja): a Caja privilege, granted to the cashier because it is their job"
```

---

### Task 5: Los endpoints de la caja

**Files:**
- Create: `apps/backend/app/Infrastructure/Http/Controllers/Cash/CashSessionController.php`
- Create: `apps/backend/app/Infrastructure/Http/Resources/CashSessionResource.php`
- Create: `apps/backend/app/Infrastructure/Http/Resources/CashMovementResource.php`
- Modify: `apps/backend/routes/api.php` (grupo de tenant, después del bloque `// Service logs`)
- Test: `apps/backend/tests/Feature/Cash/CashEndpointsTest.php`

**Interfaces:**
- Consumes: `CashRegister` (Task 2), `StaffPrivileges::CASH` (Task 4).
- Produces:

```
GET    /api/v1/cash-session?date=YYYY-MM-DD      la caja de ese día (default hoy), o null
POST   /api/v1/cash-sessions                     abrir  { business_date?, opening_amount }
POST   /api/v1/cash-sessions/{id}/movements      mover  { type, amount, reason }
POST   /api/v1/cash-sessions/{id}/close          cerrar { counted_amount, notes? }
```

Forma de `CashSessionResource`:

```
id, business_date (Y-m-d), status,
opening_amount, opened_at (ISO), opened_by { id, name } | null,
closed_at | null, closed_by { id, name } | null,
counted_amount | null, expected_amount | null, difference | null,
notes | null,
movements: [CashMovementResource]        // siempre presente, puede ir vacío
```

Forma de `CashMovementResource`: `id, type, amount, reason, created_at (ISO), created_by { id, name } | null`.

**El cierre ciego se implementa solo:** `expected_amount` y `difference` son
columnas que valen `NULL` hasta el cierre, así que el recurso las devuelve
`null` mientras la caja está abierta sin que haya que acordarse de ocultarlas.
**No agregues un campo calculado con el esperado a este recurso.**

`GET /cash-session` devuelve además `cash_without_session`, el efectivo
cobrado ese día que no cayó en ninguna caja — es el aviso, y no revela el
esperado de nada.

- [ ] **Step 1: Write the failing test**

```php
<?php
// apps/backend/tests/Feature/Cash/CashEndpointsTest.php

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

    $this->member = function (string $role) {
        $user = UserModel::factory()->create();
        TenantUserModel::create([
            'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
            'user_id' => $user->id, 'role' => $role, 'is_active' => true,
        ]);
        return $user;
    };

    $this->owner   = ($this->member)('owner');
    $this->cashier = ($this->member)('cashier');
    $this->washer  = ($this->member)('washer');

    $this->as = fn (UserModel $u) => $this->actingAs($u)
        ->withHeader('X-Tenant', $this->tenant->slug);

    $this->hoy = now()->toDateString();

    $service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->owner->id, 'type' => 'sedan',
    ]);
    $this->cobrarEfectivo = function (float $monto) use ($service, $resource) {
        $log = ServiceLogModel::factory()->create([
            'tenant_id' => $this->tenant->id,
            'client_resource_id' => $resource->id,
            'service_id' => $service->id,
            'attended_by' => $this->owner->id,
            'created_by' => $this->owner->id,
            'price_charged' => $monto,
            'payment_status' => 'unpaid',
            'paid_at' => null,
            'payment_method' => null,
            'log_date' => now()->toDateString(),
        ]);
        app(PaymentLedger::class)->recordForServiceLog($log, $monto, 'cash', null, $this->owner->id);
    };

    $this->abrir = fn (float $base = 30.00) => ($this->as)($this->cashier)
        ->postJson('/api/v1/cash-sessions', ['opening_amount' => $base]);
});

test('with no session open the endpoint says so without inventing one', function () {
    ($this->as)($this->cashier)
        ->getJson('/api/v1/cash-session')
        ->assertOk()
        ->assertJsonPath('data', null)
        ->assertJsonPath('meta.cash_without_session', 0);
});

test('cash collected before opening shows up as an orphan, and does not block', function () {
    ($this->cobrarEfectivo)(12.00);

    ($this->as)($this->cashier)
        ->getJson('/api/v1/cash-session')
        ->assertOk()
        ->assertJsonPath('data', null)
        ->assertJsonPath('meta.cash_without_session', 12);
});

test('a cashier opens the drawer with a base', function () {
    ($this->abrir)(30.00)
        ->assertStatus(201)
        ->assertJsonPath('data.status', 'open')
        ->assertJsonPath('data.opening_amount', 30)
        ->assertJsonPath('data.business_date', $this->hoy)
        ->assertJsonPath('data.opened_by.id', $this->cashier->id);
});

test('an open drawer never reveals what the system expects', function () {
    // El cierre ciego, en la capa que importa: la que el navegador ve.
    ($this->abrir)(30.00);
    ($this->cobrarEfectivo)(25.00);

    ($this->as)($this->cashier)
        ->getJson('/api/v1/cash-session')
        ->assertOk()
        ->assertJsonPath('data.expected_amount', null)
        ->assertJsonPath('data.difference', null);
});

test('opening twice in a day is refused with a reason', function () {
    ($this->abrir)();

    ($this->abrir)()
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'ALREADY_OPEN');
});

test('a washer may not touch the drawer', function () {
    ($this->as)($this->washer)
        ->postJson('/api/v1/cash-sessions', ['opening_amount' => 30])
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'FORBIDDEN');
});

test('a movement lands in the session and comes back with it', function () {
    $id = ($this->abrir)()->json('data.id');

    ($this->as)($this->cashier)
        ->postJson("/api/v1/cash-sessions/{$id}/movements", [
            'type' => 'expense', 'amount' => 4.50, 'reason' => 'Almuerzo',
        ])
        ->assertStatus(201)
        ->assertJsonPath('data.type', 'expense')
        ->assertJsonPath('data.amount', 4.5);

    ($this->as)($this->cashier)
        ->getJson('/api/v1/cash-session')
        ->assertOk()
        ->assertJsonPath('data.movements.0.reason', 'Almuerzo');
});

test('a movement needs a reason', function () {
    // Un egreso sin motivo es un faltante con otro nombre.
    $id = ($this->abrir)()->json('data.id');

    ($this->as)($this->cashier)
        ->postJson("/api/v1/cash-sessions/{$id}/movements", ['type' => 'expense', 'amount' => 4.50])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['reason']);
});

test('closing reveals the three numbers at once', function () {
    $id = ($this->abrir)(30.00)->json('data.id');
    ($this->cobrarEfectivo)(20.00);

    ($this->as)($this->cashier)
        ->postJson("/api/v1/cash-sessions/{$id}/close", ['counted_amount' => 48.00])
        ->assertOk()
        ->assertJsonPath('data.status', 'closed')
        ->assertJsonPath('data.counted_amount', 48)
        ->assertJsonPath('data.expected_amount', 50)
        ->assertJsonPath('data.difference', -2)
        ->assertJsonPath('data.closed_by.id', $this->cashier->id);
});

test('a closed drawer is not reopened', function () {
    $id = ($this->abrir)()->json('data.id');
    ($this->as)($this->cashier)->postJson("/api/v1/cash-sessions/{$id}/close", ['counted_amount' => 30]);

    ($this->as)($this->cashier)
        ->postJson("/api/v1/cash-sessions/{$id}/close", ['counted_amount' => 99])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'SESSION_CLOSED');
});

test('a closed day can still be read', function () {
    $id = ($this->abrir)(30.00)->json('data.id');
    ($this->as)($this->cashier)->postJson("/api/v1/cash-sessions/{$id}/close", ['counted_amount' => 31]);

    ($this->as)($this->cashier)
        ->getJson('/api/v1/cash-session?date=' . $this->hoy)
        ->assertOk()
        ->assertJsonPath('data.status', 'closed')
        ->assertJsonPath('data.difference', 1);
});

test('another tenants drawer is not reachable by id', function () {
    $id = ($this->abrir)()->json('data.id');

    $otro = TenantModel::factory()->create(['status' => 'active']);
    $intruso = UserModel::factory()->create();
    TenantUserModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $otro->id,
        'user_id' => $intruso->id, 'role' => 'owner', 'is_active' => true,
    ]);

    $this->actingAs($intruso)->withHeader('X-Tenant', $otro->slug)
        ->postJson("/api/v1/cash-sessions/{$id}/close", ['counted_amount' => 1])
        ->assertStatus(404);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Cash/CashEndpointsTest.php`
Expected: FAIL — 404 en todas: las rutas no existen.

- [ ] **Step 3: Write the resources**

```php
<?php
// apps/backend/app/Infrastructure/Http/Resources/CashMovementResource.php

namespace App\Infrastructure\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CashMovementResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'         => $this->id,
            'type'       => $this->type,
            'amount'     => (float) $this->amount,
            'reason'     => $this->reason,
            'created_at' => $this->created_at?->toIso8601String(),
            'created_by' => $this->author
                ? ['id' => $this->author->id, 'name' => $this->author->name]
                : null,
        ];
    }
}
```

```php
<?php
// apps/backend/app/Infrastructure/Http/Resources/CashSessionResource.php

namespace App\Infrastructure\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * `expected_amount` y `difference` salen `null` mientras la caja está
 * abierta porque las columnas están vacías hasta el cierre. Eso ES el cierre
 * ciego: no hay nada que acordarse de ocultar. NO agregues acá un campo
 * calculado con el esperado.
 */
class CashSessionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'              => $this->id,
            'business_date'   => $this->business_date?->toDateString(),
            'status'          => $this->status,
            'opening_amount'  => (float) $this->opening_amount,
            'opened_at'       => $this->opened_at?->toIso8601String(),
            'opened_by'       => $this->opener
                ? ['id' => $this->opener->id, 'name' => $this->opener->name]
                : null,
            'closed_at'       => $this->closed_at?->toIso8601String(),
            'closed_by'       => $this->closer
                ? ['id' => $this->closer->id, 'name' => $this->closer->name]
                : null,
            'counted_amount'  => $this->counted_amount === null ? null : (float) $this->counted_amount,
            'expected_amount' => $this->expected_amount === null ? null : (float) $this->expected_amount,
            'difference'      => $this->difference === null ? null : (float) $this->difference,
            'notes'           => $this->notes,
            'movements'       => CashMovementResource::collection(
                $this->whenLoaded('movements', $this->movements, collect())
            ),
        ];
    }
}
```

- [ ] **Step 4: Write the controller**

```php
<?php
// apps/backend/app/Infrastructure/Http/Controllers/Cash/CashSessionController.php

declare(strict_types=1);

namespace App\Infrastructure\Http\Controllers\Cash;

use App\Application\Services\CashRegister;
use App\Domain\Cash\CashRegisterException;
use App\Domain\Tenant\StaffPrivileges;
use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Http\Resources\CashMovementResource;
use App\Infrastructure\Http\Resources\CashSessionResource;
use App\Infrastructure\Persistence\Models\CashSessionModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CashSessionController extends Controller
{
    public function __construct(private CashRegister $cash) {}

    /**
     * Mismo criterio que ServiceLogController::may(): el super-admin no tiene
     * fila en tenant_users y el dueño nunca queda afuera de su propio local.
     */
    private function mayManage(Request $request): bool
    {
        if ($request->user()?->is_super_admin) {
            return true;
        }

        $role = TenantUserModel::where('tenant_id', app('current_tenant_id'))
            ->where('user_id', $request->user()->id)
            ->value('role');

        $permissions = TenantModel::find(app('current_tenant_id'))?->settings['permissions'] ?? [];

        return StaffPrivileges::granted(
            $role,
            StaffPrivileges::CASH,
            is_array($permissions) ? $permissions : [],
        );
    }

    private function forbidden(): JsonResponse
    {
        return response()->json([
            'error' => [
                'code'    => 'FORBIDDEN',
                'message' => 'No tenés permiso para manejar la caja.',
            ],
        ], 403);
    }

    private function fromException(CashRegisterException $e): JsonResponse
    {
        return response()->json([
            'error' => ['code' => $e->errorCode, 'message' => $e->getMessage()],
        ], 422);
    }

    /**
     * La caja de un día. Devuelve `data: null` cuando ese día no tuvo caja —
     * un 404 haría que el front trate "todavía no abrieron" como un error.
     */
    public function current(Request $request): JsonResponse
    {
        if (!$this->mayManage($request)) {
            return $this->forbidden();
        }

        $tenantId = app('current_tenant_id');
        $date = (string) $request->get('date', now()->toDateString());

        $session = $this->cash->sessionFor($tenantId, $date);
        $session?->load(['movements.author', 'opener', 'closer']);

        return response()->json([
            'data' => $session ? new CashSessionResource($session) : null,
            'meta' => [
                'cash_without_session' => $this->cash->cashCollectedWithoutSession($tenantId, $date),
            ],
        ]);
    }

    public function open(Request $request): JsonResponse
    {
        if (!$this->mayManage($request)) {
            return $this->forbidden();
        }

        $data = $request->validate([
            'business_date'  => 'sometimes|date',
            'opening_amount' => 'required|numeric|min:0',
        ]);

        try {
            $session = $this->cash->openSession(
                app('current_tenant_id'),
                (string) ($data['business_date'] ?? now()->toDateString()),
                (float) $data['opening_amount'],
                $request->user()?->id,
            );
        } catch (CashRegisterException $e) {
            return $this->fromException($e);
        }

        $session->load(['movements.author', 'opener', 'closer']);

        return (new CashSessionResource($session))->response()->setStatusCode(201);
    }

    public function addMovement(Request $request, string $id): JsonResponse
    {
        if (!$this->mayManage($request)) {
            return $this->forbidden();
        }

        $data = $request->validate([
            // Un egreso sin motivo es un faltante con otro nombre.
            'type'   => 'required|in:expense,withdrawal,deposit',
            'amount' => 'required|numeric|min:0.01',
            'reason' => 'required|string|max:200',
        ]);

        // findOrFail bajo el TenantScope: la caja de otro tenant es un 404,
        // no un 403 — no confirmamos que el id exista.
        $session = CashSessionModel::findOrFail($id);

        try {
            $movement = $this->cash->addMovement(
                $session,
                $data['type'],
                (float) $data['amount'],
                $data['reason'],
                $request->user()?->id,
            );
        } catch (CashRegisterException $e) {
            return $this->fromException($e);
        }

        return (new CashMovementResource($movement->load('author')))
            ->response()->setStatusCode(201);
    }

    public function close(Request $request, string $id): JsonResponse
    {
        if (!$this->mayManage($request)) {
            return $this->forbidden();
        }

        $data = $request->validate([
            'counted_amount' => 'required|numeric|min:0',
            'notes'          => 'sometimes|nullable|string|max:500',
        ]);

        $session = CashSessionModel::findOrFail($id);

        try {
            $cerrada = $this->cash->closeSession(
                $session,
                (float) $data['counted_amount'],
                $request->user()?->id,
                $data['notes'] ?? null,
            );
        } catch (CashRegisterException $e) {
            return $this->fromException($e);
        }

        $cerrada->load(['movements.author', 'opener', 'closer']);

        return (new CashSessionResource($cerrada))->response()->setStatusCode(200);
    }
}
```

- [ ] **Step 5: Wire the routes**

En `apps/backend/routes/api.php`, dentro del mismo grupo de tenant donde viven
las rutas de `service-logs`, justo después del bloque
`Route::get('service-logs/{id}/invoice/xml', ...)`, agregá:

```php
            // Caja del día. Ver el spec: el esperado no se expone hasta el
            // cierre, así que no hay endpoint que lo devuelva.
            Route::get('cash-session', [CashSessionController::class, 'current']);
            Route::post('cash-sessions', [CashSessionController::class, 'open']);
            Route::post('cash-sessions/{id}/movements', [CashSessionController::class, 'addMovement']);
            Route::post('cash-sessions/{id}/close', [CashSessionController::class, 'close']);
```

y el import arriba del archivo, junto a los otros controladores:

```php
use App\Infrastructure\Http\Controllers\Cash\CashSessionController;
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Cash/CashEndpointsTest.php`
Expected: PASS — 12 passed

- [ ] **Step 7: Commit**

```bash
git add apps/backend/app/Infrastructure/Http/Controllers/Cash/CashSessionController.php \
        apps/backend/app/Infrastructure/Http/Resources/CashSessionResource.php \
        apps/backend/app/Infrastructure/Http/Resources/CashMovementResource.php \
        apps/backend/routes/api.php \
        apps/backend/tests/Feature/Cash/CashEndpointsTest.php
git commit -m "feat(caja): endpoints that never hand the cashier the number they are supposed to count"
```

---

### Task 6: La capa de datos del admin

**Files:**
- Create: `apps/admin-v2/src/domain/entities/cash-session.ts`
- Create: `apps/admin-v2/src/domain/repositories/cash-session.repository.ts`
- Create: `apps/admin-v2/src/infrastructure/api/repositories/api-cash-session.repository.ts`
- Create: `apps/admin-v2/src/application/use-cases/cash/get-cash-session.use-case.ts`
- Create: `apps/admin-v2/src/application/use-cases/cash/open-cash-session.use-case.ts`
- Create: `apps/admin-v2/src/application/use-cases/cash/add-cash-movement.use-case.ts`
- Create: `apps/admin-v2/src/application/use-cases/cash/close-cash-session.use-case.ts`
- Create: `apps/admin-v2/src/presentation/hooks/use-cash-session.ts`
- Modify: `apps/admin-v2/src/infrastructure/providers/repository.provider.tsx`

**Interfaces:**
- Consumes: los endpoints de la Task 5.
- Produces:

```ts
// domain/entities/cash-session.ts
export type CashSessionStatus = 'open' | 'closed';
export type CashMovementType = 'expense' | 'withdrawal' | 'deposit';
export interface CashActor { id: string; name: string }
export interface CashMovement {
  id: string; type: CashMovementType; amount: number; reason: string;
  createdAt: Date; createdBy: CashActor | null;
}
export interface CashSession {
  id: string; businessDate: string; status: CashSessionStatus;
  openingAmount: number; openedAt: Date; openedBy: CashActor | null;
  closedAt: Date | null; closedBy: CashActor | null;
  countedAmount: number | null; expectedAmount: number | null; difference: number | null;
  notes: string | null; movements: CashMovement[];
}
export interface CashSessionSnapshot { session: CashSession | null; cashWithoutSession: number }
export const MOVEMENT_TYPE_LABEL: Record<CashMovementType, string>;

// hooks
export function useCashSession(date: string)          // UseQueryResult<CashSessionSnapshot>
export function useOpenCashSession()                  // mutate({ businessDate?, openingAmount })
export function useAddCashMovement()                  // mutate({ sessionId, type, amount, reason })
export function useCloseCashSession()                 // mutate({ sessionId, countedAmount, notes? })
```

Las tres mutaciones invalidan `['cash-session']` **y** `['service-logs']`: un
retiro no cambia los tiles, pero cerrar la caja sí cambia lo que la pantalla
tiene que mostrar, y el cajero no debería tener que recargar.

- [ ] **Step 1: Write the entity**

```ts
// apps/admin-v2/src/domain/entities/cash-session.ts

/** La caja de un día: una base al abrir, un conteo al cerrar. */
export type CashSessionStatus = 'open' | 'closed';

/**
 * `withdrawal` es el dueño llevándose la recaudación: sale del cajón pero no
 * es un gasto. Mezclarlo con `expense` ensucia cualquier reporte de gastos.
 */
export type CashMovementType = 'expense' | 'withdrawal' | 'deposit';

export interface CashActor {
  id: string;
  name: string;
}

export interface CashMovement {
  id: string;
  type: CashMovementType;
  amount: number;
  reason: string;
  createdAt: Date;
  createdBy: CashActor | null;
}

/**
 * `expectedAmount` y `difference` son `null` mientras la caja está abierta.
 * No es que falten: el backend no los calcula hasta el cierre, a propósito.
 * Si la UI los muestra antes, el cajero copia el número y el arqueo no
 * controla nada.
 */
export interface CashSession {
  id: string;
  businessDate: string;
  status: CashSessionStatus;
  openingAmount: number;
  openedAt: Date;
  openedBy: CashActor | null;
  closedAt: Date | null;
  closedBy: CashActor | null;
  countedAmount: number | null;
  expectedAmount: number | null;
  difference: number | null;
  notes: string | null;
  movements: CashMovement[];
}

export interface CashSessionSnapshot {
  session: CashSession | null;
  /** Efectivo cobrado ese día sin caja abierta. Es un aviso, no un bloqueo. */
  cashWithoutSession: number;
}

export interface OpenCashSessionInput {
  businessDate?: string;
  openingAmount: number;
}

export interface AddCashMovementInput {
  sessionId: string;
  type: CashMovementType;
  amount: number;
  reason: string;
}

export interface CloseCashSessionInput {
  sessionId: string;
  countedAmount: number;
  notes?: string;
}

export const MOVEMENT_TYPE_LABEL: Record<CashMovementType, string> = {
  expense: 'Egreso',
  withdrawal: 'Retiro',
  deposit: 'Ingreso',
};
```

- [ ] **Step 2: Write the repository interface**

```ts
// apps/admin-v2/src/domain/repositories/cash-session.repository.ts

import type {
  CashMovement,
  CashSession,
  CashSessionSnapshot,
  OpenCashSessionInput,
  AddCashMovementInput,
  CloseCashSessionInput,
} from '@/domain/entities/cash-session';

/** Sin `reopen`: una caja cerrada no se reabre. Se corrige con un movimiento
    en la caja siguiente. */
export interface CashSessionRepository {
  get(date: string): Promise<CashSessionSnapshot>;
  open(input: OpenCashSessionInput): Promise<CashSession>;
  addMovement(input: AddCashMovementInput): Promise<CashMovement>;
  close(input: CloseCashSessionInput): Promise<CashSession>;
}
```

- [ ] **Step 3: Write the API repository**

```ts
// apps/admin-v2/src/infrastructure/api/repositories/api-cash-session.repository.ts

import api from '@/infrastructure/api/client';
import type {
  CashActor,
  CashMovement,
  CashMovementType,
  CashSession,
  CashSessionSnapshot,
  CashSessionStatus,
  OpenCashSessionInput,
  AddCashMovementInput,
  CloseCashSessionInput,
} from '@/domain/entities/cash-session';
import type { CashSessionRepository } from '@/domain/repositories/cash-session.repository';

type Raw = Record<string, unknown>;

function mapActor(raw: unknown): CashActor | null {
  if (!raw) return null;
  const a = raw as Raw;
  return { id: a.id as string, name: a.name as string };
}

function mapMovement(raw: Raw): CashMovement {
  return {
    id: raw.id as string,
    type: raw.type as CashMovementType,
    amount: Number(raw.amount ?? 0),
    reason: raw.reason as string,
    createdAt: new Date(raw.created_at as string),
    createdBy: mapActor(raw.created_by),
  };
}

function mapSession(raw: Raw): CashSession {
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    id: raw.id as string,
    businessDate: raw.business_date as string,
    status: raw.status as CashSessionStatus,
    openingAmount: Number(raw.opening_amount ?? 0),
    openedAt: new Date(raw.opened_at as string),
    openedBy: mapActor(raw.opened_by),
    closedAt: raw.closed_at ? new Date(raw.closed_at as string) : null,
    closedBy: mapActor(raw.closed_by),
    countedAmount: num(raw.counted_amount),
    expectedAmount: num(raw.expected_amount),
    difference: num(raw.difference),
    notes: (raw.notes as string) ?? null,
    movements: ((raw.movements as Raw[]) ?? []).map(mapMovement),
  };
}

export class ApiCashSessionRepository implements CashSessionRepository {
  async get(date: string): Promise<CashSessionSnapshot> {
    const { data: res } = await api.get<{ data: Raw | null; meta?: Raw }>('/cash-session', {
      params: { date },
    });
    return {
      session: res.data ? mapSession(res.data) : null,
      cashWithoutSession: Number(res.meta?.cash_without_session ?? 0),
    };
  }

  async open(input: OpenCashSessionInput): Promise<CashSession> {
    const { data: res } = await api.post<{ data: Raw }>('/cash-sessions', {
      opening_amount: input.openingAmount,
      ...(input.businessDate ? { business_date: input.businessDate } : {}),
    });
    return mapSession(res.data);
  }

  async addMovement(input: AddCashMovementInput): Promise<CashMovement> {
    const { data: res } = await api.post<{ data: Raw }>(
      `/cash-sessions/${input.sessionId}/movements`,
      { type: input.type, amount: input.amount, reason: input.reason },
    );
    return mapMovement(res.data);
  }

  async close(input: CloseCashSessionInput): Promise<CashSession> {
    const { data: res } = await api.post<{ data: Raw }>(
      `/cash-sessions/${input.sessionId}/close`,
      { counted_amount: input.countedAmount, ...(input.notes ? { notes: input.notes } : {}) },
    );
    return mapSession(res.data);
  }
}
```

- [ ] **Step 4: Write the use cases**

```ts
// apps/admin-v2/src/application/use-cases/cash/get-cash-session.use-case.ts
import type { CashSessionRepository } from '@/domain/repositories/cash-session.repository';
import type { CashSessionSnapshot } from '@/domain/entities/cash-session';

export class GetCashSessionUseCase {
  constructor(private repo: CashSessionRepository) {}
  execute(date: string): Promise<CashSessionSnapshot> {
    return this.repo.get(date);
  }
}
```

```ts
// apps/admin-v2/src/application/use-cases/cash/open-cash-session.use-case.ts
import type { CashSessionRepository } from '@/domain/repositories/cash-session.repository';
import type { CashSession, OpenCashSessionInput } from '@/domain/entities/cash-session';

export class OpenCashSessionUseCase {
  constructor(private repo: CashSessionRepository) {}
  execute(input: OpenCashSessionInput): Promise<CashSession> {
    return this.repo.open(input);
  }
}
```

```ts
// apps/admin-v2/src/application/use-cases/cash/add-cash-movement.use-case.ts
import type { CashSessionRepository } from '@/domain/repositories/cash-session.repository';
import type { CashMovement, AddCashMovementInput } from '@/domain/entities/cash-session';

export class AddCashMovementUseCase {
  constructor(private repo: CashSessionRepository) {}
  execute(input: AddCashMovementInput): Promise<CashMovement> {
    return this.repo.addMovement(input);
  }
}
```

```ts
// apps/admin-v2/src/application/use-cases/cash/close-cash-session.use-case.ts
import type { CashSessionRepository } from '@/domain/repositories/cash-session.repository';
import type { CashSession, CloseCashSessionInput } from '@/domain/entities/cash-session';

export class CloseCashSessionUseCase {
  constructor(private repo: CashSessionRepository) {}
  execute(input: CloseCashSessionInput): Promise<CashSession> {
    return this.repo.close(input);
  }
}
```

- [ ] **Step 5: Register the repository in the provider**

En `apps/admin-v2/src/infrastructure/providers/repository.provider.tsx`, tres
agregados que siguen el patrón de `serviceStaff`:

```ts
import type { CashSessionRepository } from '@/domain/repositories/cash-session.repository';
```
```ts
import { ApiCashSessionRepository } from '../api/repositories/api-cash-session.repository';
```
```ts
// dentro de la interfaz Repositories
  cashSession: CashSessionRepository;
```
```ts
// dentro del objeto que devuelve useMemo
      cashSession: new ApiCashSessionRepository(),
```

- [ ] **Step 6: Write the hooks**

```ts
// apps/admin-v2/src/presentation/hooks/use-cash-session.ts
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/infrastructure/providers/repository.provider';
import { GetCashSessionUseCase } from '@/application/use-cases/cash/get-cash-session.use-case';
import { OpenCashSessionUseCase } from '@/application/use-cases/cash/open-cash-session.use-case';
import { AddCashMovementUseCase } from '@/application/use-cases/cash/add-cash-movement.use-case';
import { CloseCashSessionUseCase } from '@/application/use-cases/cash/close-cash-session.use-case';
import type {
  OpenCashSessionInput,
  AddCashMovementInput,
  CloseCashSessionInput,
} from '@/domain/entities/cash-session';

export function useCashSession(date: string) {
  const repo = useRepository('cashSession');
  return useQuery({
    queryKey: ['cash-session', date],
    queryFn: () => new GetCashSessionUseCase(repo).execute(date),
  });
}

/**
 * Las tres mutaciones invalidan también `service-logs`: cerrar la caja no
 * cambia un cobro, pero el cajero que acaba de cerrar mira la misma pantalla
 * y no debería tener que recargarla para verla al día.
 */
function useCashMutation<TInput, TResult>(run: (input: TInput) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cash-session'] });
      qc.invalidateQueries({ queryKey: ['service-logs'] });
    },
  });
}

export function useOpenCashSession() {
  const repo = useRepository('cashSession');
  return useCashMutation((input: OpenCashSessionInput) =>
    new OpenCashSessionUseCase(repo).execute(input),
  );
}

export function useAddCashMovement() {
  const repo = useRepository('cashSession');
  return useCashMutation((input: AddCashMovementInput) =>
    new AddCashMovementUseCase(repo).execute(input),
  );
}

export function useCloseCashSession() {
  const repo = useRepository('cashSession');
  return useCashMutation((input: CloseCashSessionInput) =>
    new CloseCashSessionUseCase(repo).execute(input),
  );
}
```

- [ ] **Step 7: Typecheck**

Run: `cd apps/admin-v2 && npx tsc --noEmit`
Expected: sin errores. Correlo hasta el final.

- [ ] **Step 8: Commit**

```bash
git add apps/admin-v2/src/domain/entities/cash-session.ts \
        apps/admin-v2/src/domain/repositories/cash-session.repository.ts \
        apps/admin-v2/src/infrastructure/api/repositories/api-cash-session.repository.ts \
        apps/admin-v2/src/application/use-cases/cash/ \
        apps/admin-v2/src/presentation/hooks/use-cash-session.ts \
        apps/admin-v2/src/infrastructure/providers/repository.provider.tsx
git commit -m "feat(caja): admin data layer for the drawer"
```

---

### Task 7: Los tres diálogos

**Files:**
- Create: `apps/admin-v2/src/presentation/components/features/cash/open-cash-dialog.tsx`
- Create: `apps/admin-v2/src/presentation/components/features/cash/cash-movement-dialog.tsx`
- Create: `apps/admin-v2/src/presentation/components/features/cash/close-cash-dialog.tsx`

**Interfaces:**
- Consumes: `useOpenCashSession`, `useAddCashMovement`, `useCloseCashSession` (Task 6).
- Produces:

```tsx
<OpenCashDialog open={boolean} businessDate={string} onClose={() => void} />
<CashMovementDialog open={boolean} sessionId={string} onClose={() => void} />
<CloseCashDialog open={boolean} sessionId={string} onClose={() => void} />
```

`CloseCashDialog` tiene dos pantallas dentro del mismo diálogo: primero el
conteo, y después del submit el resultado con esperado y diferencia. **No hay
forma de ver la segunda sin pasar por la primera** — así se implementa el
cierre ciego del lado del navegador.

Van sin test automatizado: el repo no tiene infraestructura de tests de
componentes en `admin-v2`. Se verifican en la Task 9, en el navegador.

- [ ] **Step 1: Write the open dialog**

```tsx
// apps/admin-v2/src/presentation/components/features/cash/open-cash-dialog.tsx
'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';
import { useOpenCashSession } from '@/presentation/hooks/use-cash-session';

interface Props {
  open: boolean;
  businessDate: string;
  onClose: () => void;
}

export function OpenCashDialog({ open, businessDate, onClose }: Props) {
  const [amount, setAmount] = useState('');
  const mutation = useOpenCashSession();

  useEffect(() => {
    if (open) setAmount('');
  }, [open]);

  async function submit() {
    const base = Number(amount);
    if (!Number.isFinite(base) || base < 0) {
      toast.error('Poné la base con la que arranca el cajón');
      return;
    }

    try {
      await mutation.mutateAsync({ businessDate, openingAmount: base });
      toast.success('Caja abierta');
      onClose();
    } catch (e) {
      // El backend explica por qué: puede ser la caja de ayer sin cerrar.
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      toast.error(msg ?? 'No se pudo abrir la caja');
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Abrir caja</DialogTitle>
          <DialogDescription>
            La base es el efectivo con el que arranca el cajón, antes del primer cobro.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="opening-amount">Base</Label>
          <Input
            id="opening-amount"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Abriendo…' : 'Abrir caja'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Write the movement dialog**

```tsx
// apps/admin-v2/src/presentation/components/features/cash/cash-movement-dialog.tsx
'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ArrowDownLeft, ArrowUpRight, HandCoins } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';
import { cn } from '@/shared/utils/cn';
import { useAddCashMovement } from '@/presentation/hooks/use-cash-session';
import type { CashMovementType } from '@/domain/entities/cash-session';

interface Props {
  open: boolean;
  sessionId: string;
  onClose: () => void;
}

/**
 * Retiro y egreso salen los dos del cajón, pero un retiro NO es un gasto: el
 * dueño se lleva su recaudación. Separarlos acá es lo que permite que el
 * reporte de gastos de mañana no cuente la plata del dueño como costo.
 */
const TYPES: { value: CashMovementType; label: string; hint: string; icon: typeof ArrowUpRight }[] = [
  { value: 'expense',    label: 'Egreso',  hint: 'Almuerzo, insumos',        icon: ArrowUpRight },
  { value: 'withdrawal', label: 'Retiro',  hint: 'El dueño se lleva la caja', icon: HandCoins },
  { value: 'deposit',    label: 'Ingreso', hint: 'Reposición de cambio',      icon: ArrowDownLeft },
];

export function CashMovementDialog({ open, sessionId, onClose }: Props) {
  const [type, setType] = useState<CashMovementType>('expense');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const mutation = useAddCashMovement();

  useEffect(() => {
    if (open) {
      setType('expense');
      setAmount('');
      setReason('');
    }
  }, [open]);

  async function submit() {
    const monto = Number(amount);
    if (!Number.isFinite(monto) || monto <= 0) {
      toast.error('Poné el monto del movimiento');
      return;
    }
    if (!reason.trim()) {
      // Un egreso sin motivo es un faltante con otro nombre.
      toast.error('Escribí el motivo');
      return;
    }

    try {
      await mutation.mutateAsync({ sessionId, type, amount: monto, reason: reason.trim() });
      toast.success('Movimiento registrado');
      onClose();
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      toast.error(msg ?? 'No se pudo registrar el movimiento');
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Movimiento de caja</DialogTitle>
          <DialogDescription>Plata que entra o sale del cajón sin ser un cobro.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2">
          {TYPES.map(({ value, label, hint, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setType(value)}
              aria-pressed={type === value}
              className={cn(
                'flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors',
                type === value
                  ? 'border-[var(--primary-600)] bg-[var(--primary-50)]'
                  : 'border-[var(--border)] hover:bg-[var(--bg-sunken)]',
              )}
            >
              <Icon className="h-4 w-4 text-[var(--fg-secondary)]" aria-hidden="true" />
              <span className="text-[13px] font-semibold text-[var(--fg-strong)]">{label}</span>
              <span className="text-[11px] leading-tight text-[var(--fg-muted)]">{hint}</span>
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <Label htmlFor="movement-amount">Monto</Label>
          <Input
            id="movement-amount"
            type="number"
            inputMode="decimal"
            min={0.01}
            step="0.01"
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="movement-reason">Motivo</Label>
          <Input
            id="movement-reason"
            maxLength={200}
            placeholder="Almuerzo del equipo"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Guardando…' : 'Registrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Write the blind close dialog**

```tsx
// apps/admin-v2/src/presentation/components/features/cash/close-cash-dialog.tsx
'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';
import { Textarea } from '@/presentation/components/ui/textarea';
import { useCloseCashSession } from '@/presentation/hooks/use-cash-session';
import type { CashSession } from '@/domain/entities/cash-session';

interface Props {
  open: boolean;
  sessionId: string;
  onClose: () => void;
}

const money = (v: number) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(v);

/**
 * Cierre ciego. El cajero cuenta y declara; recién después el diálogo revela
 * esperado y diferencia. No hay camino a la segunda pantalla que no pase por
 * la primera, y por eso el resultado vive en el estado de este componente y
 * no en una consulta que se pueda hacer antes.
 */
export function CloseCashDialog({ open, sessionId, onClose }: Props) {
  const [counted, setCounted] = useState('');
  const [notes, setNotes] = useState('');
  const [result, setResult] = useState<CashSession | null>(null);
  const mutation = useCloseCashSession();

  useEffect(() => {
    if (open) {
      setCounted('');
      setNotes('');
      setResult(null);
    }
  }, [open]);

  async function submit() {
    const contado = Number(counted);
    if (!Number.isFinite(contado) || contado < 0) {
      toast.error('Poné cuánto efectivo contaste');
      return;
    }

    try {
      const cerrada = await mutation.mutateAsync({
        sessionId,
        countedAmount: contado,
        notes: notes.trim() || undefined,
      });
      setResult(cerrada);
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      toast.error(msg ?? 'No se pudo cerrar la caja');
    }
  }

  const diff = result?.difference ?? 0;
  const diffTone =
    diff === 0
      ? 'text-[var(--fg-strong)]'
      : diff > 0
        ? 'text-[var(--success-700)]'
        : 'text-[var(--danger-700)]';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        {result === null ? (
          <>
            <DialogHeader>
              <DialogTitle>Cerrar caja</DialogTitle>
              <DialogDescription>
                Contá el efectivo del cajón y escribí cuánto hay. El sistema te dice después
                cuánto esperaba.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="counted-amount">Efectivo contado</Label>
              <Input
                id="counted-amount"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                placeholder="0,00"
                value={counted}
                onChange={(e) => setCounted(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="close-notes">Notas (opcional)</Label>
              <Textarea
                id="close-notes"
                rows={2}
                maxLength={500}
                placeholder="Faltó un billete de $5"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>Cancelar</Button>
              <Button onClick={submit} disabled={mutation.isPending}>
                {mutation.isPending ? 'Cerrando…' : 'Cerrar caja'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Caja cerrada</DialogTitle>
              <DialogDescription>Esto es lo que el sistema esperaba en el cajón.</DialogDescription>
            </DialogHeader>

            <dl className="space-y-2 text-[14px]">
              <div className="flex items-baseline justify-between">
                <dt className="text-[var(--fg-secondary)]">Contado</dt>
                <dd className="font-semibold tabular-nums">{money(result.countedAmount ?? 0)}</dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt className="text-[var(--fg-secondary)]">Esperado</dt>
                <dd className="font-semibold tabular-nums">{money(result.expectedAmount ?? 0)}</dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-[var(--border)] pt-2">
                <dt className="font-semibold">Diferencia</dt>
                <dd className={`text-[20px] font-bold tabular-nums ${diffTone}`}>
                  {diff > 0 ? '+' : ''}{money(diff)}
                </dd>
              </div>
            </dl>

            <DialogFooter>
              <Button onClick={onClose}>Listo</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Confirm the Textarea component exists**

Run: `ls apps/admin-v2/src/presentation/components/ui/textarea.tsx`
Expected: existe. Si no, agregalo con `cd apps/admin-v2 && npx shadcn@latest add textarea` antes de seguir.

- [ ] **Step 5: Typecheck**

Run: `cd apps/admin-v2 && npx tsc --noEmit`
Expected: sin errores. Correlo hasta el final.

- [ ] **Step 6: Commit**

```bash
git add apps/admin-v2/src/presentation/components/features/cash/
git commit -m "feat(caja): open, move and blind-close dialogs"
```

---

### Task 8: La tarjeta en Registro Diario

**Files:**
- Create: `apps/admin-v2/src/presentation/components/features/cash/cash-session-card.tsx`
- Modify: `apps/admin-v2/src/presentation/app/(tenant)/service-log/page.tsx` (alrededor de la línea 206, donde se renderiza `<DailySummary />`)
- Modify: `apps/admin-v2/src/presentation/components/features/service-logs/daily-summary.tsx` (renombre de etiquetas)

**Interfaces:**
- Consumes: `useCashSession` (Task 6), los tres diálogos (Task 7), `canManageCash` (Task 4).
- Produces: `<CashSessionCard date={string} />`.

**El renombre, ya decidido:** en `daily-summary.tsx` hay cuatro strings que
dicen «caja del día» y ahora nombran otra cosa. Pasan a «resumen del día».
Son exactamente:

| Hoy | Queda |
|---|---|
| `Caja del día` (texto de la tira colapsada) | `Resumen del día` |
| `aria-label="Mostrar la caja del día"` | `aria-label="Mostrar el resumen del día"` |
| `aria-label="Ocultar la caja del día"` | `aria-label="Ocultar el resumen del día"` |
| `title="Ocultar la caja del día"` | `title="Ocultar el resumen del día"` |

- [ ] **Step 1: Rename the tiles strip**

En `apps/admin-v2/src/presentation/components/features/service-logs/daily-summary.tsx`
aplicá los cuatro reemplazos de la tabla de arriba. **No toques nada más de
ese archivo** — los tiles ya salen del libro de pagos desde la fase 1.

Y en `apps/admin-v2/src/presentation/app/(tenant)/service-log/page.tsx`,
actualizá el comentario que hay sobre `<DailySummary />` para que no siga
llamando «caja» a los tiles:

```tsx
        {/* Resumen del día — deliberadamente no se estrecha con los filtros de
            abajo: existen para encontrar una fila, no para reformular el día. */}
        <DailySummary date={dateStr} />
```

- [ ] **Step 2: Write the card**

```tsx
// apps/admin-v2/src/presentation/components/features/cash/cash-session-card.tsx
'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, Lock, Wallet } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { useCashSession } from '@/presentation/hooks/use-cash-session';
import { usePermissions } from '@/presentation/hooks/use-permissions';
import { OpenCashDialog } from '@/presentation/components/features/cash/open-cash-dialog';
import { CashMovementDialog } from '@/presentation/components/features/cash/cash-movement-dialog';
import { CloseCashDialog } from '@/presentation/components/features/cash/close-cash-dialog';
import { MOVEMENT_TYPE_LABEL } from '@/domain/entities/cash-session';

const money = (v: number) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(v);

interface Props {
  date: string;
}

/**
 * La caja del día, arriba del registro. Deliberadamente NO muestra el
 * esperado mientras está abierta: el backend no lo manda, y si lo mandara el
 * cajero copiaría ese número en el conteo.
 */
export function CashSessionCard({ date }: Props) {
  const { canManageCash } = usePermissions();
  const { data, isLoading } = useCashSession(date);
  const [openDialog, setOpenDialog] = useState<'open' | 'movement' | 'close' | null>(null);

  // Sin el privilegio la tarjeta no existe: un lavador no tiene por qué saber
  // cuánto hay en el cajón.
  if (!canManageCash) return null;

  if (isLoading) {
    return <Skeleton className="h-[76px] w-full rounded-xl" />;
  }

  const session = data?.session ?? null;
  const huerfano = data?.cashWithoutSession ?? 0;

  // Sin caja abierta. El aviso aparece sólo si además hubo efectivo cobrado:
  // la caja no bloquea el mostrador, pero tampoco calla la plata suelta.
  if (session === null) {
    return (
      <>
        <section
          aria-label="Caja del día"
          className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3"
        >
          <Wallet className="h-4 w-4 shrink-0 text-[var(--fg-muted)]" aria-hidden="true" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
            Caja del día
          </span>
          <span className="text-[13px] text-[var(--fg-secondary)]">Sin abrir</span>

          {huerfano > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--warning-50)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--warning-700)] ring-1 ring-[var(--warning-200)]">
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              {money(huerfano)} cobrados en efectivo sin caja
            </span>
          )}

          <Button size="sm" className="ml-auto" onClick={() => setOpenDialog('open')}>
            Abrir caja
          </Button>
        </section>

        <OpenCashDialog
          open={openDialog === 'open'}
          businessDate={date}
          onClose={() => setOpenDialog(null)}
        />
      </>
    );
  }

  const abierta = session.status === 'open';
  const hora = format(session.openedAt, 'HH:mm');
  const dia = format(parseISO(session.businessDate), "d 'de' MMMM", { locale: es });
  const movimientos = session.movements.length;
  const diff = session.difference ?? 0;

  return (
    <>
      <section
        aria-label="Caja del día"
        className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3"
      >
        {abierta ? (
          <Wallet className="h-4 w-4 shrink-0 text-[var(--fg-muted)]" aria-hidden="true" />
        ) : (
          <Lock className="h-4 w-4 shrink-0 text-[var(--fg-muted)]" aria-hidden="true" />
        )}
        <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
          Caja del día
        </span>

        <span className="text-[13px] text-[var(--fg-secondary)]">
          {abierta
            ? `abierta ${hora}${session.openedBy ? ` por ${session.openedBy.name}` : ''}`
            : `cerrada · ${dia}`}
        </span>

        <span className="text-[13px] text-[var(--fg-secondary)]">
          Base <span className="font-semibold tabular-nums">{money(session.openingAmount)}</span>
          {movimientos > 0 && (
            <>
              {' · '}
              {movimientos} {movimientos === 1 ? 'movimiento' : 'movimientos'}
            </>
          )}
        </span>

        {!abierta && (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] font-semibold ring-1 ${
              diff === 0
                ? 'bg-[var(--bg-sunken)] text-[var(--fg-secondary)] ring-[var(--border)]'
                : diff > 0
                  ? 'bg-[var(--success-50)] text-[var(--success-700)] ring-[var(--success-200)]'
                  : 'bg-[var(--danger-50)] text-[var(--danger-700)] ring-[var(--danger-200)]'
            }`}
          >
            {diff === 0 ? 'Cuadró' : `${diff > 0 ? '+' : ''}${money(diff)}`}
          </span>
        )}

        {abierta && (
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setOpenDialog('movement')}>
              Movimiento
            </Button>
            <Button size="sm" onClick={() => setOpenDialog('close')}>
              Cerrar caja
            </Button>
          </div>
        )}
      </section>

      {/* Los movimientos, listados debajo. Se ven mientras la caja está
          abierta a propósito: son pocos y el cajero necesita revisarlos. El
          número que no se revela es el efectivo cobrado, que es el grueso. */}
      {movimientos > 0 && (
        <ul className="-mt-1 space-y-1 px-4 text-[12.5px] text-[var(--fg-secondary)]">
          {session.movements.map((m) => (
            <li key={m.id} className="flex items-baseline gap-2">
              <span className="font-semibold">{MOVEMENT_TYPE_LABEL[m.type]}</span>
              <span className="tabular-nums">
                {m.type === 'deposit' ? '+' : '−'}
                {money(m.amount)}
              </span>
              <span className="truncate text-[var(--fg-muted)]">{m.reason}</span>
            </li>
          ))}
        </ul>
      )}

      <CashMovementDialog
        open={openDialog === 'movement'}
        sessionId={session.id}
        onClose={() => setOpenDialog(null)}
      />
      <CloseCashDialog
        open={openDialog === 'close'}
        sessionId={session.id}
        onClose={() => setOpenDialog(null)}
      />
    </>
  );
}
```

- [ ] **Step 3: Wire it into the page**

En `apps/admin-v2/src/presentation/app/(tenant)/service-log/page.tsx`,
agregá el import junto a los otros componentes de feature:

```tsx
import { CashSessionCard } from '@/presentation/components/features/cash/cash-session-card';
```

y renderizá la tarjeta **arriba** del resumen, en el mismo lugar donde hoy
empieza el bloque de `<DailySummary />`:

```tsx
        {/* La caja va arriba del resumen: es lo primero que el cajero abre a
            la mañana y lo último que toca a la noche. */}
        <CashSessionCard date={dateStr} />

        {/* Resumen del día — deliberadamente no se estrecha con los filtros de
            abajo: existen para encontrar una fila, no para reformular el día. */}
        <DailySummary date={dateStr} />
```

- [ ] **Step 4: Typecheck and build**

Run: `cd apps/admin-v2 && npx tsc --noEmit && npm run lint`
Expected: sin errores en ninguno de los dos. Correlos hasta el final.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-v2/src/presentation/components/features/cash/cash-session-card.tsx \
        "apps/admin-v2/src/presentation/app/(tenant)/service-log/page.tsx" \
        apps/admin-v2/src/presentation/components/features/service-logs/daily-summary.tsx
git commit -m "feat(caja): the drawer sits above the day, and the tiles stop calling themselves caja"
```

---

### Task 9: Verificación de la fase

**Files:** ninguno. Es la corrida que decide si la fase se puede desplegar.

- [ ] **Step 1: Full backend suite**

Run: `cd apps/backend && composer test`
Expected: **exactamente los 9 fallos pre-existentes**, ni uno más. El total verde tiene que subir de 418 a **458**: 40 tests nuevos — 6 en `CashModelTest`, 13 en `CashRegisterTest`, 4 en `CashStampingTest`, 5 en `CashPrivilegeTest`, 12 en `CashEndpointsTest`. Anotá el número real.

- [ ] **Step 2: Migrations from scratch on MySQL**

Run: `cd apps/backend && php artisan migrate:fresh && php artisan migrate:status | tail -8`

Expected: todas corren limpias, con las tres nuevas al final. **Sin `--seed`** — el seeder está roto de antes (`TenantSeeder` inserta la columna `plan`, eliminada por `2026_04_22_200100`); arreglarlo no es de esta fase.

**Ojo:** `migrate:fresh` borra la base local. Si tenés datos de prueba que
querés conservar, corré esto contra una base scratch:

```bash
mysql -h127.0.0.1 -uroot -e "DROP DATABASE IF EXISTS turnly_scratch; CREATE DATABASE turnly_scratch;"
DB_DATABASE=turnly_scratch php artisan migrate:fresh
mysql -h127.0.0.1 -uroot -e "DROP DATABASE turnly_scratch;"
```

- [ ] **Step 3: Admin builds**

Run: `cd apps/admin-v2 && npx tsc --noEmit && npm run build`
Expected: ambos verdes. Correlos hasta el final: un `tsc` cortado a la mitad es la forma habitual de romper el deploy de Vercel en este repo.

- [ ] **Step 4: The blind close is really blind**

Con el stack levantado (`composer dev` en `apps/backend`, `npm run dev` en `apps/admin-v2`), entrá a Registro Diario y comprobá, en este orden:

1. Sin caja abierta, la tarjeta dice **Sin abrir** y hay botón **Abrir caja**.
2. Registrá un servicio cobrando en efectivo **antes** de abrir. La tarjeta muestra el aviso `$X cobrados en efectivo sin caja` y **el cobro no se bloquea**.
3. Abrí la caja con base $30. La tarjeta pasa a `abierta HH:MM por <nombre>`.
4. Registrá un servicio cobrando $20 en efectivo, y otro cobrando $50 con tarjeta.
5. Agregá un egreso de $4,50 «Almuerzo». Aparece en la lista debajo de la tarjeta.
6. **Abrí las DevTools, pestaña Network, y mirá la respuesta de `GET /api/v1/cash-session`.** `expected_amount` y `difference` tienen que ser `null`. Si traen un número, el cierre ciego está roto y la fase no se despliega.
7. Cerrá la caja declarando $45,50. El diálogo revela: contado $45,50 · esperado $45,50 · **Cuadró**.
   (30 base + 20 efectivo − 4,50 egreso = 45,50. La tarjeta de $50 no entra.)
8. La tarjeta queda `cerrada` con el chip **Cuadró**, y ya no hay botones.
9. Recargá: sigue cerrada. No hay forma de reabrirla.

- [ ] **Step 5: The privilege really gates**

Entrá con un usuario **lavador** al mismo Registro Diario: la tarjeta de caja **no aparece**. Entrá a Configuración → Permisos: existe la columna **Caja**, el Cajero la tiene en `full` y el Lavador en `none`. Quitásela al Cajero y comprobá que a ese usuario le desaparece la tarjeta.

- [ ] **Step 6: The tiles did not move**

Los tiles de **RESUMEN DEL DÍA** tienen que mostrar los mismos números que antes de esta fase — la caja no cambia lo que ya salía del libro de pagos. Si un tile se movió, es un defecto.

- [ ] **Step 7: Report**

Contá qué pasó en cada paso, con el número de tests del paso 1 y las cifras del arqueo del paso 4.

---

## Notas de ejecución

**Rama.** Esta fase se apoya en la fase 1, que hoy vive sin desplegar en
`feat/registro-bitacora-asignados` junto a lavador/secador. Seguí en esa rama
salvo que el usuario decida otra cosa: separarlas ahora obliga a un cherry-pick
de seis commits antes de escribir la primera línea.

**Lo que esta fase deliberadamente NO hace:**
- No permite cobrar montos parciales desde ninguna pantalla (eso es la fase 3).
- No muestra deuda de clientes (fase 4).
- No arregla `ReportController::range()` (:284) ni `monthly()` (:384), que
  siguen sumando `price_charged` por método. Van a mentir el día que exista el
  abono, no antes — el arreglo va **antes de la fase 3**, no acá.
- No hay arqueo por turno: una caja por día no responde de quién fue el
  faltante si trabajaron dos. Está asumido en el spec.
- No hay conciliación bancaria: lo que dice «transferencia» se cree.

**Si `expectedFor` y el arqueo del navegador no coinciden.** Casi siempre es
`cash_session_id` sin estampar: un cobro hecho por un camino que no pasa por
`PaymentLedger`. Buscá con `grep -rn "PaymentModel::create" apps/backend/app`
— tiene que haber exactamente **un** resultado, dentro de `PaymentLedger`.
