# Deuda de clientes (libro de pagos, fase 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un cliente se lleve el vehículo debiendo, que el dueño cargue las deudas que hoy lleva en un cuaderno, y que un solo cobro cancele varias de esas deudas repartiéndose de la más vieja a la más nueva.

**Architecture:** La deuda **no se almacena**: es la suma de lo impago de los `service_logs` marcados `left_owing` más las `manual_debts` cargadas a mano. Una columna booleana y una tabla es todo el delta de datos — `payment_allocations` ya es polimórfica y sólo gana un tercer `payable_type`. La consulta vive en un servicio de aplicación (`DebtLedger`) porque las cuatro features que quedan para después la reusan.

**Tech Stack:** Laravel 13 (Domain → Application → Infrastructure), Pest + SQLite en memoria; Next.js 16 + React Query + shadcn/ui en `apps/admin-v2`.

**Spec:** `docs/superpowers/specs/2026-08-19-abono-y-deuda-design.md` (Fase 4 — Deuda). Spec base: `docs/superpowers/specs/2026-08-18-libro-de-pagos-caja-abono-deuda-design.md`.

**Fases previas:** 1 (libro), 2 (caja) y 3 (abono), todas construidas. Existen `payments`, `payment_allocations`, `PaymentLedger` con cobros parciales, `cash_sessions` y `CashRegister`.

## Global Constraints

- **La deuda es derivada.** No hay columna de saldo en ningún lado. Si aparece una, es un defecto: se desincroniza y nadie sabe cuál miente.
- **`left_owing` es lo que separa deuda de olvido.** Un servicio impago **sin** la marca es un pendiente del día, no una deuda. Sin esa distinción la lista de deudores se llena de cobros que nadie cerró y deja de ser creíble en un mes.
- **La deuda cuelga de la placa (`client_resource_id`), y además del cliente cuando el recurso tiene uno.** No se exige identificar al cliente para dejar salir el auto: el walk-in es justo el que se va debiendo, y pedirle la cédula con el auto afuera es la peor fricción posible.
- **`PaymentLedger` sigue siendo el único escritor del libro.** El cobro de deuda es un método más suyo, no un servicio nuevo.
- **La consulta de deuda vive en `DebtLedger`, no en el controlador.** Límite de crédito, intereses, recordatorios y estado de cuenta —los cuatro que quedaron para después— la reusan. Incrustarla en el controlador es lo único que los bloquearía.
- **Nada de N+1 en la lista de Clientes.** La deuda de todos los recursos sale de **dos consultas agregadas**, no de una por fila.
- **`manual_debts.incurred_on` es la fecha en que se generó la deuda, no la de carga.** El dueño carga en agosto una deuda de junio y el reparto FIFO tiene que ponerla primero.
- Tests backend: `cd apps/backend && ./vendor/bin/pest <ruta>`.
- **La suite tiene 9 fallos PRE-EXISTENTES.** El verde de partida es **473 passed / 19 skipped** en SQLite.
- **`tests/Feature/Report/` y `tests/Feature/Payment/ReportsRangeFromLedgerTest.php` sólo corren contra MySQL.** En SQLite se saltean.
- `npm run lint` en el admin ya está rojo de antes. El gate real es `npx tsc --noEmit && npm run build`.
- Admin: Next.js 16. Leé la guía en `apps/admin-v2/node_modules/next/dist/docs/` antes de escribir código de Next.
- **Decidido con el usuario:** la pantalla de deudores **no es una sección nueva**. Es un filtro «Solo con deuda» y una columna de saldo dentro de **Clientes**, que ya lista los `client_resources`. Sin entrada en el sidebar y sin columna nueva en la matriz de permisos.

---

### Task 1: La marca y la tabla

**Files:**
- Create: `apps/backend/database/migrations/2026_08_21_100001_add_left_owing_to_service_logs.php`
- Create: `apps/backend/database/migrations/2026_08_21_100002_create_manual_debts_table.php`
- Create: `apps/backend/app/Infrastructure/Persistence/Models/ManualDebtModel.php`
- Modify: `apps/backend/app/Infrastructure/Persistence/Models/PaymentAllocationModel.php`
- Modify: `apps/backend/app/Infrastructure/Persistence/Models/ServiceLogModel.php` (`$fillable`, casts)
- Test: `apps/backend/tests/Feature/Debt/DebtModelTest.php`

**Interfaces:**
- Consumes: `payment_allocations` (fase 1).
- Produces:
  - Columna `service_logs.left_owing` (boolean, default `false`, cast a `boolean`, agregada a `$fillable`).
  - `ManualDebtModel` — `$fillable = ['tenant_id','client_resource_id','client_id','amount','reason','incurred_on','created_by']`; casts `amount` decimal:2, `incurred_on` date; relaciones `resource()`, `client()`.
  - Constante `PaymentAllocationModel::PAYABLE_MANUAL_DEBT = 'manual_debt'`.

- [ ] **Step 1: Write the failing test**

```php
<?php
// apps/backend/tests/Feature/Debt/DebtModelTest.php

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ManualDebtModel;
use App\Infrastructure\Persistence\Models\PaymentAllocationModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    $this->user = UserModel::factory()->create();
    $this->service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->user->id, 'type' => 'sedan',
    ]);
});

test('a service log can be marked as having left owing', function () {
    $log = ServiceLogModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $this->resource->id,
        'service_id' => $this->service->id,
        'attended_by' => $this->user->id,
        'created_by' => $this->user->id,
        'price_charged' => 20.00,
        'payment_status' => 'unpaid',
        'left_owing' => true,
    ]);

    expect($log->fresh()->left_owing)->toBeTrue();
});

test('a service log does not leave owing by default', function () {
    // La marca es explícita: sin ella, un impago es un pendiente del día.
    $log = ServiceLogModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $this->resource->id,
        'service_id' => $this->service->id,
        'attended_by' => $this->user->id,
        'created_by' => $this->user->id,
        'price_charged' => 20.00,
    ]);

    expect($log->fresh()->left_owing)->toBeFalse();
});

test('a manual debt records what the notebook said and when it happened', function () {
    $d = ManualDebtModel::create([
        'tenant_id'          => $this->tenant->id,
        'client_resource_id' => $this->resource->id,
        'client_id'          => $this->user->id,
        'amount'             => 45.00,
        'reason'             => '3 lavados de julio, cuaderno',
        'incurred_on'        => '2026-07-15',
        'created_by'         => $this->user->id,
    ]);

    expect((float) $d->fresh()->amount)->toBe(45.0);
    expect($d->fresh()->incurred_on->toDateString())->toBe('2026-07-15');
    // La fecha en que se generó, no la de carga: el dueño carga en agosto
    // una deuda de junio y el reparto tiene que ponerla primero.
    expect($d->incurred_on->toDateString())->not->toBe($d->created_at->toDateString());
});

test('a manual debt can hang off a plate with no client', function () {
    $huerfana = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => null, 'type' => 'sedan',
    ]);

    $d = ManualDebtModel::create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $huerfana->id,
        'client_id' => null,
        'amount' => 12.00,
        'reason' => 'Lavado de la camioneta blanca',
        'incurred_on' => '2026-08-01',
        'created_by' => $this->user->id,
    ]);

    expect($d->fresh()->client_id)->toBeNull();
    expect($d->fresh()->client_resource_id)->toBe($huerfana->id);
});

test('the tenant scope hides another tenants debt', function () {
    $otro = TenantModel::factory()->create(['status' => 'active']);
    ManualDebtModel::create([
        'tenant_id' => $otro->id, 'client_id' => $this->user->id,
        'amount' => 99.00, 'reason' => 'x', 'incurred_on' => '2026-08-01',
    ]);
    ManualDebtModel::create([
        'tenant_id' => $this->tenant->id, 'client_resource_id' => $this->resource->id,
        'amount' => 5.00, 'reason' => 'y', 'incurred_on' => '2026-08-01',
    ]);

    expect(ManualDebtModel::count())->toBe(1);
    expect((float) ManualDebtModel::first()->amount)->toBe(5.0);
});

test('an allocation can point at a manual debt', function () {
    // Para esto la tabla nació polimórfica en la fase 1.
    expect(PaymentAllocationModel::PAYABLE_MANUAL_DEBT)->toBe('manual_debt');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Debt/DebtModelTest.php`
Expected: FAIL — `Class "App\Infrastructure\Persistence\Models\ManualDebtModel" not found`

- [ ] **Step 3: Write the left_owing migration**

```php
<?php
// apps/backend/database/migrations/2026_08_21_100001_add_left_owing_to_service_logs.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Lo que separa una deuda de un olvido.
     *
     * Sin esta marca, "deuda" sería todo servicio impago — y cada "cobrar al
     * retirar" que nadie cerró se convertiría en deudor. La lista pierde
     * credibilidad en un mes y el dueño vuelve al cuaderno.
     *
     * El default es false y se escribe explícitamente al completar: el cajero
     * responde "¿cobrás o se va debiendo?" en el único momento en que sabe la
     * respuesta.
     */
    public function up(): void
    {
        Schema::table('service_logs', function (Blueprint $table) {
            $table->boolean('left_owing')->default(false)->after('payment_status');
            // La consulta caliente: los deudores de un tenant.
            $table->index(['tenant_id', 'left_owing', 'payment_status']);
        });
    }

    public function down(): void
    {
        Schema::table('service_logs', function (Blueprint $table) {
            $table->dropIndex(['tenant_id', 'left_owing', 'payment_status']);
            $table->dropColumn('left_owing');
        });
    }
};
```

- [ ] **Step 4: Write the manual_debts migration**

```php
<?php
// apps/backend/database/migrations/2026_08_21_100002_create_manual_debts_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Las deudas que el dueño ya lleva anotadas fuera del sistema.
     *
     * Sin esto la pantalla de deudores arranca en cero para gente que sí
     * debe, el dueño sigue usando el cuaderno y la feature no sirve.
     *
     * No se cargan como servicios retroactivos a propósito: inventar
     * servicios que nunca ocurrieron ensucia los reportes de producción y el
     * consumo de inventario para siempre.
     */
    public function up(): void
    {
        Schema::create('manual_debts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            // Al menos uno de los dos. La placa alcanza para un walk-in; el
            // cliente aparece cuando el recurso lo tiene.
            $table->uuid('client_resource_id')->nullable();
            $table->uuid('client_id')->nullable();
            $table->decimal('amount', 12, 2);
            $table->string('reason', 200);
            // Cuándo se generó, no cuándo se cargó: el dueño carga en agosto
            // una deuda de junio, y el reparto FIFO la tiene que poner
            // primero. `created_at` responde la otra pregunta.
            $table->date('incurred_on');
            $table->uuid('created_by')->nullable();
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->foreign('client_resource_id')->references('id')->on('client_resources')->nullOnDelete();
            $table->foreign('client_id')->references('id')->on('users')->nullOnDelete();
            $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();

            $table->index(['tenant_id', 'client_resource_id']);
            $table->index(['tenant_id', 'client_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('manual_debts');
    }
};
```

- [ ] **Step 5: Write the model and widen the two existing ones**

```php
<?php
// apps/backend/app/Infrastructure/Persistence/Models/ManualDebtModel.php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Models;

use App\Infrastructure\Persistence\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Una deuda que no nació de un servicio del sistema: la libreta del dueño.
 * Se salda con el mismo reparto que un servicio impago, porque
 * `payment_allocations` es polimórfica.
 */
class ManualDebtModel extends Model
{
    use HasUuids, BelongsToTenant;

    protected $table = 'manual_debts';

    protected $fillable = [
        'tenant_id', 'client_resource_id', 'client_id',
        'amount', 'reason', 'incurred_on', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'amount'      => 'decimal:2',
            'incurred_on' => 'date',
        ];
    }

    public function resource(): BelongsTo
    {
        return $this->belongsTo(ClientResourceModel::class, 'client_resource_id');
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(UserModel::class, 'client_id');
    }
}
```

En `apps/backend/app/Infrastructure/Persistence/Models/PaymentAllocationModel.php`, junto a las otras dos constantes:

```php
    public const PAYABLE_RESERVATION = 'reservation';
    /** La libreta del dueño, cargada a mano. */
    public const PAYABLE_MANUAL_DEBT = 'manual_debt';
```

En `apps/backend/app/Infrastructure/Persistence/Models/ServiceLogModel.php`, agregá `'left_owing'` a `$fillable` (junto a `'payment_status'`) y al array de casts:

```php
            'left_owing' => 'boolean',
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Debt/DebtModelTest.php`
Expected: PASS — 6 passed

- [ ] **Step 7: Verify the migrations run on MySQL**

Run: `cd apps/backend && php artisan migrate`
Expected: las dos corren limpias.

- [ ] **Step 8: Commit**

```bash
git add apps/backend/database/migrations/2026_08_21_1000*.php \
        apps/backend/app/Infrastructure/Persistence/Models/ManualDebtModel.php \
        apps/backend/app/Infrastructure/Persistence/Models/PaymentAllocationModel.php \
        apps/backend/app/Infrastructure/Persistence/Models/ServiceLogModel.php \
        apps/backend/tests/Feature/Debt/DebtModelTest.php
git commit -m "feat(deuda): mark what left owing, and take in the debts the owner kept on paper"
```

---

### Task 2: `DebtLedger`, la consulta que las cuatro features futuras reusan

**Files:**
- Create: `apps/backend/app/Application/Services/DebtLedger.php`
- Test: `apps/backend/tests/Feature/Debt/DebtLedgerTest.php`

**Interfaces:**
- Consumes: `ManualDebtModel`, `left_owing` (Task 1), `payment_allocations` (fase 1).
- Produces:

```php
/**
 * Una línea de deuda, en el orden en que se cobra.
 * ['type' => 'service_log'|'manual_debt', 'id' => string, 'label' => string,
 *  'date' => 'Y-m-d', 'amount' => float, 'paid' => float, 'due' => float]
 */
public function outstandingFor(string $tenantId, string $clientResourceId): array
public function totalFor(string $tenantId, string $clientResourceId): float
/** [client_resource_id => saldo]. DOS consultas agregadas, no una por fila. */
public function debtByResource(string $tenantId): array
/** Reparto del más viejo al más nuevo: [['type'=>..,'id'=>..,'amount'=>float], ...] */
public function planFor(string $tenantId, string $clientResourceId, float $amount): array
```

`debtByResource` es la que alimenta la lista de Clientes. **Dos consultas agregadas para todo el tenant**, no una por fila: con doscientos vehículos, una consulta por fila convierte la pantalla del lunes en un timeout.

- [ ] **Step 1: Write the failing test**

```php
<?php
// apps/backend/tests/Feature/Debt/DebtLedgerTest.php

use App\Application\Services\DebtLedger;
use App\Application\Services\PaymentLedger;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ManualDebtModel;
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
    $this->resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->user->id, 'type' => 'sedan',
    ]);

    $this->debe = function (float $price, string $date, bool $marked = true) use ($service) {
        return ServiceLogModel::factory()->create([
            'tenant_id' => $this->tenant->id,
            'client_resource_id' => $this->resource->id,
            'service_id' => $service->id,
            'attended_by' => $this->user->id,
            'created_by' => $this->user->id,
            'price_charged' => $price,
            'payment_status' => 'unpaid',
            'paid_at' => null,
            'payment_method' => null,
            'left_owing' => $marked,
            'status' => 'completed',
            'log_date' => $date,
        ]);
    };

    $this->manual = fn (float $amount, string $date) => ManualDebtModel::create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $this->resource->id,
        'client_id' => $this->user->id,
        'amount' => $amount,
        'reason' => 'Cuaderno',
        'incurred_on' => $date,
        'created_by' => $this->user->id,
    ]);

    $this->debts  = app(DebtLedger::class);
    $this->ledger = app(PaymentLedger::class);
});

test('a service that left owing is debt', function () {
    ($this->debe)(20.00, '2026-08-02');

    expect($this->debts->totalFor($this->tenant->id, $this->resource->id))->toBe(20.0);
});

test('an unpaid service that was NOT marked is not debt', function () {
    // Es un pendiente del día, no un deudor. Sin esta línea la lista se
    // llena de cobros que nadie cerró.
    ($this->debe)(20.00, '2026-08-02', false);

    expect($this->debts->totalFor($this->tenant->id, $this->resource->id))->toBe(0.0);
});

test('an abono reduces the debt instead of cancelling it', function () {
    $log = ($this->debe)(20.00, '2026-08-02');
    $this->ledger->recordForServiceLog($log, 5.00, 'cash', null, $this->user->id);

    expect($this->debts->totalFor($this->tenant->id, $this->resource->id))->toBe(15.0);
});

test('a manual debt counts the same as a service', function () {
    ($this->manual)(15.00, '2026-07-15');
    ($this->debe)(20.00, '2026-08-02');

    expect($this->debts->totalFor($this->tenant->id, $this->resource->id))->toBe(35.0);
});

test('the outstanding list is ordered oldest first, mixing both sources', function () {
    ($this->debe)(20.00, '2026-08-02');
    ($this->manual)(15.00, '2026-07-15');
    ($this->debe)(15.00, '2026-08-11');

    $items = $this->debts->outstandingFor($this->tenant->id, $this->resource->id);

    expect(array_column($items, 'type'))->toBe(['manual_debt', 'service_log', 'service_log']);
    expect(array_column($items, 'due'))->toBe([15.0, 20.0, 15.0]);
});

test('the plan spends the payment from the oldest debt down', function () {
    // El ejemplo del spec: debe $50, paga $30.
    ($this->manual)(15.00, '2026-07-15');
    ($this->debe)(20.00, '2026-08-02');
    ($this->debe)(15.00, '2026-08-11');

    $plan = $this->debts->planFor($this->tenant->id, $this->resource->id, 30.00);

    expect($plan)->toHaveCount(2);
    expect($plan[0]['type'])->toBe('manual_debt');
    expect($plan[0]['amount'])->toBe(15.0);
    expect($plan[1]['type'])->toBe('service_log');
    expect($plan[1]['amount'])->toBe(15.0);
});

test('a payment bigger than the debt only plans up to the debt', function () {
    // Lo que sobra es saldo a favor, no una deuda pagada de más.
    ($this->debe)(20.00, '2026-08-02');

    $plan = $this->debts->planFor($this->tenant->id, $this->resource->id, 50.00);

    expect(array_sum(array_column($plan, 'amount')))->toBe(20.0);
});

test('debt by resource answers for the whole tenant at once', function () {
    ($this->debe)(20.00, '2026-08-02');
    ($this->manual)(15.00, '2026-07-15');

    $otroRecurso = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => null, 'type' => 'sedan',
    ]);
    ManualDebtModel::create([
        'tenant_id' => $this->tenant->id, 'client_resource_id' => $otroRecurso->id,
        'amount' => 8.00, 'reason' => 'x', 'incurred_on' => '2026-08-01',
    ]);

    $mapa = $this->debts->debtByResource($this->tenant->id);

    expect($mapa[$this->resource->id])->toBe(35.0);
    expect($mapa[$otroRecurso->id])->toBe(8.0);
});

test('debt by resource costs two queries, not one per row', function () {
    // Con doscientos vehículos, una consulta por fila convierte la pantalla
    // del lunes en un timeout. Este test es el que impide esa regresión.
    ($this->debe)(20.00, '2026-08-02');
    ($this->manual)(15.00, '2026-07-15');

    DB::enableQueryLog();
    $this->debts->debtByResource($this->tenant->id);
    $consultas = count(DB::getQueryLog());
    DB::disableQueryLog();

    expect($consultas)->toBeLessThanOrEqual(2);
});

test('a fully paid debt disappears from the list', function () {
    $log = ($this->debe)(20.00, '2026-08-02');
    $this->ledger->recordForServiceLog($log, 20.00, 'cash', null, $this->user->id);

    expect($this->debts->totalFor($this->tenant->id, $this->resource->id))->toBe(0.0);
    expect($this->debts->outstandingFor($this->tenant->id, $this->resource->id))->toBe([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Debt/DebtLedgerTest.php`
Expected: FAIL — `Class "App\Application\Services\DebtLedger" not found`

- [ ] **Step 3: Write the ledger**

```php
<?php
// apps/backend/app/Application/Services/DebtLedger.php

declare(strict_types=1);

namespace App\Application\Services;

use App\Infrastructure\Persistence\Models\ManualDebtModel;
use App\Infrastructure\Persistence\Models\PaymentAllocationModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use Illuminate\Support\Facades\DB;

/**
 * Qué debe un cliente, y en qué orden se le cobra.
 *
 * Vive acá y no en el controlador porque cuatro features que todavía no
 * existen —límite de crédito, intereses, recordatorios y estado de cuenta—
 * hacen exactamente esta pregunta. Incrustarla en un controlador es lo único
 * que las bloquearía.
 *
 * Nada de esto se almacena: la deuda es la suma de lo impago de los servicios
 * marcados `left_owing` más las deudas cargadas a mano. Un saldo guardado se
 * desincroniza y después nadie sabe cuál de los dos miente.
 */
class DebtLedger
{
    /** El mismo centavo que usa PaymentLedger para decidir si algo está saldado. */
    private const CENT = 0.005;

    /**
     * Las deudas de una placa, de la más vieja a la más nueva. Ese orden ES
     * el reparto por defecto, así que la consulta lo produce ya ordenado.
     *
     * @return array<int, array{type:string,id:string,label:string,date:string,amount:float,paid:float,due:float}>
     */
    public function outstandingFor(string $tenantId, string $clientResourceId): array
    {
        $pagado = $this->paidByPayable($tenantId);

        $items = [];

        $logs = ServiceLogModel::query()
            ->forTenant($tenantId)
            ->with(['service', 'items'])
            ->where('client_resource_id', $clientResourceId)
            ->where('left_owing', true)
            ->where('payment_status', '!=', 'paid')
            ->get();

        foreach ($logs as $log) {
            $abonado = (float) ($pagado[$log->id] ?? 0.0);
            $due = round((float) $log->price_charged - $abonado, 2);
            if ($due <= self::CENT) {
                continue;
            }

            $items[] = [
                'type'   => PaymentAllocationModel::PAYABLE_SERVICE_LOG,
                'id'     => $log->id,
                'label'  => $this->labelFor($log),
                'date'   => ($log->log_date ?? $log->created_at)?->toDateString() ?? '',
                'amount' => (float) $log->price_charged,
                'paid'   => $abonado,
                'due'    => $due,
            ];
        }

        $manuales = ManualDebtModel::query()
            ->forTenant($tenantId)
            ->where('client_resource_id', $clientResourceId)
            ->get();

        foreach ($manuales as $d) {
            $abonado = (float) ($pagado[$d->id] ?? 0.0);
            $due = round((float) $d->amount - $abonado, 2);
            if ($due <= self::CENT) {
                continue;
            }

            $items[] = [
                'type'   => PaymentAllocationModel::PAYABLE_MANUAL_DEBT,
                'id'     => $d->id,
                'label'  => $d->reason,
                'date'   => $d->incurred_on?->toDateString() ?? '',
                'amount' => (float) $d->amount,
                'paid'   => $abonado,
                'due'    => $due,
            ];
        }

        // De la más vieja a la más nueva, mezclando ambas fuentes: la deuda
        // del cuaderno de julio se cobra antes que el lavado de agosto.
        usort($items, fn ($a, $b) => $a['date'] <=> $b['date']);

        return $items;
    }

    public function totalFor(string $tenantId, string $clientResourceId): float
    {
        return round(
            array_sum(array_column($this->outstandingFor($tenantId, $clientResourceId), 'due')),
            2,
        );
    }

    /**
     * Saldo de cada placa del tenant. DOS consultas agregadas: con doscientos
     * vehículos, una por fila convierte la lista de Clientes en un timeout.
     *
     * @return array<string, float>  client_resource_id => saldo
     */
    public function debtByResource(string $tenantId): array
    {
        $porServicio = DB::table('service_logs as sl')
            ->leftJoin(DB::raw('(
                SELECT payable_id, SUM(amount) AS paid
                FROM payment_allocations
                WHERE payable_type = \'service_log\'
                GROUP BY payable_id
            ) pa'), 'pa.payable_id', '=', 'sl.id')
            ->where('sl.tenant_id', $tenantId)
            ->where('sl.left_owing', true)
            ->where('sl.payment_status', '!=', 'paid')
            ->whereNotNull('sl.client_resource_id')
            ->groupBy('sl.client_resource_id')
            ->selectRaw('sl.client_resource_id, SUM(sl.price_charged - COALESCE(pa.paid, 0)) AS due')
            ->pluck('due', 'client_resource_id');

        $porManual = DB::table('manual_debts as md')
            ->leftJoin(DB::raw('(
                SELECT payable_id, SUM(amount) AS paid
                FROM payment_allocations
                WHERE payable_type = \'manual_debt\'
                GROUP BY payable_id
            ) pa'), 'pa.payable_id', '=', 'md.id')
            ->where('md.tenant_id', $tenantId)
            ->whereNotNull('md.client_resource_id')
            ->groupBy('md.client_resource_id')
            ->selectRaw('md.client_resource_id, SUM(md.amount - COALESCE(pa.paid, 0)) AS due')
            ->pluck('due', 'client_resource_id');

        $mapa = [];
        foreach ([$porServicio, $porManual] as $fuente) {
            foreach ($fuente as $resourceId => $due) {
                $mapa[$resourceId] = round(($mapa[$resourceId] ?? 0.0) + (float) $due, 2);
            }
        }

        // Un saldo de cero no es un deudor.
        return array_filter($mapa, fn ($due) => $due > self::CENT);
    }

    /**
     * Cómo se reparte un cobro: del más viejo al más nuevo, hasta agotarlo.
     * Lo que sobre no se planifica — es saldo a favor, no una deuda pagada
     * de más.
     *
     * @return array<int, array{type:string,id:string,amount:float}>
     */
    public function planFor(string $tenantId, string $clientResourceId, float $amount): array
    {
        $restante = round($amount, 2);
        $plan = [];

        foreach ($this->outstandingFor($tenantId, $clientResourceId) as $item) {
            if ($restante <= self::CENT) {
                break;
            }

            $aplica = min($restante, $item['due']);
            $plan[] = [
                'type'   => $item['type'],
                'id'     => $item['id'],
                'amount' => round($aplica, 2),
            ];
            $restante = round($restante - $aplica, 2);
        }

        return $plan;
    }

    /**
     * Lo abonado a cada cosa, en una consulta. Se hace acá y no por fila
     * porque `outstandingFor` puede tener veinte líneas y el detalle de un
     * deudor no debería costar veinte consultas.
     *
     * @return array<string, float>  payable_id => monto abonado
     */
    private function paidByPayable(string $tenantId): array
    {
        return PaymentAllocationModel::query()
            ->forTenant($tenantId)
            ->groupBy('payable_id')
            ->selectRaw('payable_id, SUM(amount) AS paid')
            ->pluck('paid', 'payable_id')
            ->map(fn ($v) => (float) $v)
            ->all();
    }

    private function labelFor(ServiceLogModel $log): string
    {
        $items = $log->items;
        if ($items && $items->isNotEmpty()) {
            $extra = $items->count() > 1 ? ' +' . ($items->count() - 1) . ' más' : '';
            return $items->first()->label . $extra;
        }

        return $log->service?->name ?? 'Servicio';
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Debt/DebtLedgerTest.php`
Expected: PASS — 10 passed

Si el test de las dos consultas falla con un número mayor, **no lo relajes**: es el que impide que la lista de Clientes se vuelva un N+1.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/app/Application/Services/DebtLedger.php \
        apps/backend/tests/Feature/Debt/DebtLedgerTest.php
git commit -m "feat(deuda): one place answers what is owed, because four future features ask it"
```

---

### Task 3: Cobrar la deuda con un solo pago

**Files:**
- Modify: `apps/backend/app/Application/Services/PaymentLedger.php`
- Test: `apps/backend/tests/Feature/Debt/DebtPaymentTest.php`

**Interfaces:**
- Consumes: `DebtLedger` (Task 2).
- Produces:

```php
/**
 * Un pago contra la placa, repartido entre sus deudas. Sin `$allocations`
 * reparte del más viejo al más nuevo; con ellas respeta lo que el cajero
 * corrigió en pantalla.
 *
 * @param array<int, array{type:string,id:string,amount:float}> $allocations
 */
public function recordAgainstResource(
    string $tenantId,
    string $clientResourceId,
    float $amount,
    string $method,
    ?string $bank,
    ?string $receivedBy,
    array $allocations = [],
    ?string $notes = null,
): PaymentModel
```

`PaymentLedger` gana `DebtLedger` por constructor. **No al revés**: `DebtLedger` no conoce al escritor, sólo responde qué se debe.

- [ ] **Step 1: Write the failing test**

```php
<?php
// apps/backend/tests/Feature/Debt/DebtPaymentTest.php

use App\Application\Services\DebtLedger;
use App\Application\Services\PaymentLedger;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ManualDebtModel;
use App\Infrastructure\Persistence\Models\PaymentAllocationModel;
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
    $this->resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->user->id, 'type' => 'sedan',
    ]);

    $this->debe = fn (float $price, string $date) => ServiceLogModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $this->resource->id,
        'service_id' => $service->id,
        'attended_by' => $this->user->id,
        'created_by' => $this->user->id,
        'price_charged' => $price,
        'payment_status' => 'unpaid',
        'paid_at' => null,
        'payment_method' => null,
        'left_owing' => true,
        'status' => 'completed',
        'log_date' => $date,
    ]);

    $this->manual = fn (float $amount, string $date) => ManualDebtModel::create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $this->resource->id,
        'client_id' => $this->user->id,
        'amount' => $amount, 'reason' => 'Cuaderno', 'incurred_on' => $date,
        'created_by' => $this->user->id,
    ]);

    $this->debts  = app(DebtLedger::class);
    $this->ledger = app(PaymentLedger::class);
});

test('one payment cancels the oldest debts first', function () {
    // El ejemplo del spec: debe $50 (15 del cuaderno + 20 + 15), paga $30.
    $cuaderno = ($this->manual)(15.00, '2026-07-15');
    $primero  = ($this->debe)(20.00, '2026-08-02');
    $segundo  = ($this->debe)(15.00, '2026-08-11');

    $pago = $this->ledger->recordAgainstResource(
        $this->tenant->id, $this->resource->id, 30.00, 'cash', null, $this->user->id,
    );

    expect((float) $pago->amount)->toBe(30.0);
    expect($pago->allocations)->toHaveCount(2);

    // El cuaderno queda saldado, el primer servicio a medias, el último intacto.
    expect($this->debts->totalFor($this->tenant->id, $this->resource->id))->toBe(20.0);
    expect($primero->fresh()->payment_status)->toBe('partial');
    expect($segundo->fresh()->payment_status)->toBe('unpaid');
});

test('the derived columns of every touched service are recalculated', function () {
    // Si el pago no sincroniza la fila, la lista del día sigue diciendo
    // "Pendiente" sobre un servicio que ya se cobró.
    $log = ($this->debe)(20.00, '2026-08-02');

    $this->ledger->recordAgainstResource(
        $this->tenant->id, $this->resource->id, 20.00, 'cash', null, $this->user->id,
    );

    expect($log->fresh()->payment_status)->toBe('paid');
    expect($log->fresh()->payment_method)->toBe('cash');
    expect($log->fresh()->paid_at)->not->toBeNull();
});

test('a manual debt gets its own allocation', function () {
    $cuaderno = ($this->manual)(15.00, '2026-07-15');

    $pago = $this->ledger->recordAgainstResource(
        $this->tenant->id, $this->resource->id, 15.00, 'cash', null, $this->user->id,
    );

    $alloc = $pago->allocations->first();
    expect($alloc->payable_type)->toBe(PaymentAllocationModel::PAYABLE_MANUAL_DEBT);
    expect($alloc->payable_id)->toBe($cuaderno->id);
    expect($this->debts->totalFor($this->tenant->id, $this->resource->id))->toBe(0.0);
});

test('the cashier can correct the split before confirming', function () {
    $cuaderno = ($this->manual)(15.00, '2026-07-15');
    $servicio = ($this->debe)(20.00, '2026-08-02');

    // Contra el FIFO: el cajero decide pagar el servicio, no el cuaderno.
    $pago = $this->ledger->recordAgainstResource(
        $this->tenant->id, $this->resource->id, 15.00, 'cash', null, $this->user->id,
        [['type' => 'service_log', 'id' => $servicio->id, 'amount' => 15.00]],
    );

    expect($pago->allocations)->toHaveCount(1);
    expect($pago->allocations->first()->payable_id)->toBe($servicio->id);
    expect($servicio->fresh()->payment_status)->toBe('partial');
});

test('paying more than owed leaves the rest unallocated', function () {
    // Saldo a favor del cliente, no una deuda pagada de más.
    ($this->debe)(20.00, '2026-08-02');

    $pago = $this->ledger->recordAgainstResource(
        $this->tenant->id, $this->resource->id, 50.00, 'cash', null, $this->user->id,
    );

    expect((float) $pago->amount)->toBe(50.0);
    expect($pago->unallocatedAmount())->toBe(30.0);
    expect($this->debts->totalFor($this->tenant->id, $this->resource->id))->toBe(0.0);
});

test('the payment carries the client of the plate', function () {
    ($this->debe)(20.00, '2026-08-02');

    $pago = $this->ledger->recordAgainstResource(
        $this->tenant->id, $this->resource->id, 20.00, 'cash', null, $this->user->id,
    );

    expect($pago->client_id)->toBe($this->user->id);
});

test('a debt payment lands in the open cash session', function () {
    // Cobrar una deuda vieja es plata que entra hoy: tiene que cuadrar el
    // arqueo de hoy.
    $caja = app(\App\Application\Services\CashRegister::class)
        ->openSession($this->tenant->id, now()->toDateString(), 0.00, $this->user->id);
    ($this->debe)(20.00, '2026-08-02');

    $pago = $this->ledger->recordAgainstResource(
        $this->tenant->id, $this->resource->id, 20.00, 'cash', null, $this->user->id,
    );

    expect($pago->cash_session_id)->toBe($caja->id);
    expect(app(\App\Application\Services\CashRegister::class)->expectedFor($caja->fresh()))->toBe(20.0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Debt/DebtPaymentTest.php`
Expected: FAIL — `Call to undefined method ...PaymentLedger::recordAgainstResource()`

- [ ] **Step 3: Write the method**

En `apps/backend/app/Application/Services/PaymentLedger.php`, el constructor pasa a:

```php
    public function __construct(
        private CashRegister $cash,
        private DebtLedger $debts,
    ) {}
```

y agregá el método al final de la clase, antes de `syncLogPaymentState`:

```php
    /**
     * Un pago contra la placa, repartido entre sus deudas.
     *
     * Cobrar cuatro deudas de a una es donde el cajero se equivoca, así que
     * esto es un solo pago con varias asignaciones. Sin `$allocations`
     * reparte del más viejo al más nuevo; con ellas respeta lo que el cajero
     * corrigió antes de confirmar.
     *
     * @param array<int, array{type:string,id:string,amount:float}> $allocations
     */
    public function recordAgainstResource(
        string $tenantId,
        string $clientResourceId,
        float $amount,
        string $method,
        ?string $bank,
        ?string $receivedBy,
        array $allocations = [],
        ?string $notes = null,
    ): PaymentModel {
        $plan = $allocations !== []
            ? $allocations
            : $this->debts->planFor($tenantId, $clientResourceId, $amount);

        return DB::transaction(function () use (
            $tenantId, $clientResourceId, $amount, $method, $bank, $receivedBy, $plan, $notes
        ) {
            $resource = ClientResourceModel::query()
                ->forTenant($tenantId)
                ->whereKey($clientResourceId)
                ->first();

            $sesion = $this->cash->currentSession($tenantId);

            $payment = PaymentModel::create([
                'tenant_id'       => $tenantId,
                'client_id'       => $resource?->client_id,
                'amount'          => $amount,
                'method'          => $method,
                'bank'            => $method === 'transfer' ? $bank : null,
                'paid_at'         => now(),
                'received_by'     => $receivedBy,
                'cash_session_id' => $sesion?->id,
                'notes'           => $notes,
            ]);

            foreach ($plan as $linea) {
                if ((float) $linea['amount'] <= 0) {
                    continue;
                }

                PaymentAllocationModel::create([
                    'tenant_id'    => $tenantId,
                    'payment_id'   => $payment->id,
                    'payable_type' => $linea['type'],
                    'payable_id'   => $linea['id'],
                    'amount'       => $linea['amount'],
                ]);

                // Las columnas de la fila del servicio son un reflejo del
                // libro: sin esto, la lista del día seguiría diciendo
                // "Pendiente" sobre algo que acaba de cobrarse.
                if ($linea['type'] === PaymentAllocationModel::PAYABLE_SERVICE_LOG) {
                    $log = ServiceLogModel::query()->forTenant($tenantId)->find($linea['id']);
                    if ($log) {
                        $this->syncLogPaymentState($log);
                    }
                }
            }

            return $payment->fresh('allocations');
        });
    }
```

Agregá los imports que falten arriba del archivo:

```php
use App\Infrastructure\Persistence\Models\ClientResourceModel;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Debt/DebtPaymentTest.php`
Expected: PASS — 7 passed

- [ ] **Step 5: Run every payment, cash and debt test**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Payment/ tests/Feature/Cash/ tests/Feature/Debt/`
Expected: verde salvo los 5 saltados de reportes. Inyectar `DebtLedger` en `PaymentLedger` cambia cómo se resuelve del contenedor; si algo rompe, es ahí.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/app/Application/Services/PaymentLedger.php \
        apps/backend/tests/Feature/Debt/DebtPaymentTest.php
git commit -m "feat(deuda): one payment settles several debts, oldest first"
```

---

### Task 4: Completar pregunta si se va debiendo

**Files:**
- Modify: `apps/backend/app/Infrastructure/Http/Controllers/ServiceLog/ServiceLogController.php` (`complete()`)
- Modify: `apps/backend/app/Application/Services/ServiceLogEventRecorder.php`
- Modify: `apps/backend/app/Infrastructure/Persistence/Models/ServiceLogEventModel.php`
- Modify: `apps/backend/app/Infrastructure/Http/Resources/ServiceLogResource.php`
- Test: `apps/backend/tests/Feature/Debt/LeftOwingTest.php`

**Interfaces:**
- Consumes: `left_owing` (Task 1).
- Produces:
  - `PATCH /service-logs/{id}/complete` acepta `left_owing` (boolean, opcional).
  - `ServiceLogEventModel::EVENT_LEFT_OWING = 'left_owing'`.
  - `ServiceLogEventRecorder::leftOwing(ServiceLogModel $log, float $amount, ?string $actorId): void`.
  - `ServiceLogResource` gana `left_owing` (bool).

**El campo es opcional a propósito.** La app móvil y cualquier otro consumidor completan como siempre y el servicio queda como pendiente del día, no como deuda. Quien pregunta es el diálogo del admin, que es donde alguien sabe la respuesta.

- [ ] **Step 1: Write the failing test**

```php
<?php
// apps/backend/tests/Feature/Debt/LeftOwingTest.php

use App\Application\Services\DebtLedger;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceLogEventModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Str;

beforeEach(function () {
    // business_type distinto de car_wash: completar no exige lavador ni
    // secador, que es otra feature y no la que se prueba acá.
    $this->tenant = TenantModel::factory()->create([
        'status' => 'active', 'business_type' => 'barbershop',
    ]);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    $this->owner = UserModel::factory()->create();
    TenantUserModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $this->tenant->id,
        'user_id' => $this->owner->id, 'role' => 'owner', 'is_active' => true,
    ]);

    $service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->owner->id, 'type' => 'sedan',
    ]);

    $this->log = fn () => ServiceLogModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $this->resource->id,
        'service_id' => $service->id,
        'attended_by' => $this->owner->id,
        'created_by' => $this->owner->id,
        'price_charged' => 20.00,
        'payment_status' => 'unpaid',
        'paid_at' => null,
        'payment_method' => null,
        'status' => 'in_progress',
        'log_date' => now()->toDateString(),
    ]);

    $this->as = fn () => $this->actingAs($this->owner)
        ->withHeader('X-Tenant', $this->tenant->slug);

    $this->debts = app(DebtLedger::class);
});

test('completing with left_owing turns the balance into debt', function () {
    $log = ($this->log)();

    ($this->as)()
        ->patchJson("/api/v1/service-logs/{$log->id}/complete", ['left_owing' => true])
        ->assertOk();

    expect($log->fresh()->left_owing)->toBeTrue();
    expect($this->debts->totalFor($this->tenant->id, $this->resource->id))->toBe(20.0);
});

test('completing without the flag leaves it a pending of the day', function () {
    // El default importa: la app móvil completa sin conocer el campo, y eso
    // no puede convertir cada olvido en un deudor.
    $log = ($this->log)();

    ($this->as)()
        ->patchJson("/api/v1/service-logs/{$log->id}/complete")
        ->assertOk();

    expect($log->fresh()->left_owing)->toBeFalse();
    expect($this->debts->totalFor($this->tenant->id, $this->resource->id))->toBe(0.0);
});

test('a paid service cannot be marked as leaving owing', function () {
    // No hay saldo que deber. Marcarlo sería un deudor de cero.
    $log = ($this->log)();
    ($this->as)()->postJson("/api/v1/service-logs/{$log->id}/payment", ['method' => 'cash']);

    ($this->as)()
        ->patchJson("/api/v1/service-logs/{$log->id}/complete", ['left_owing' => true])
        ->assertOk();

    expect($log->fresh()->left_owing)->toBeFalse();
});

test('the trail records that it left owing, and for how much', function () {
    $log = ($this->log)();

    ($this->as)()->patchJson("/api/v1/service-logs/{$log->id}/complete", ['left_owing' => true]);

    $evento = ServiceLogEventModel::withoutGlobalScopes()
        ->where('service_log_id', $log->id)
        ->where('event', 'left_owing')
        ->first();

    expect($evento)->not->toBeNull();
    expect((float) $evento->detail['amount'])->toBe(20.0);
});

test('the resource exposes the mark so the row can shout it', function () {
    $log = ($this->log)();
    ($this->as)()->patchJson("/api/v1/service-logs/{$log->id}/complete", ['left_owing' => true]);

    ($this->as)()
        ->getJson("/api/v1/service-logs/{$log->id}")
        ->assertOk()
        ->assertJsonPath('data.left_owing', true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Debt/LeftOwingTest.php`
Expected: FAIL — `left_owing` queda en `false` después de completar.

- [ ] **Step 3: Add the event type and the recorder method**

En `apps/backend/app/Infrastructure/Persistence/Models/ServiceLogEventModel.php`, junto a las otras constantes de evento:

```php
    /** Se llevó el vehículo debiendo. Es lo que separa deuda de olvido. */
    public const EVENT_LEFT_OWING = 'left_owing';
```

y agregala al array de eventos válidos si el modelo tiene uno (buscá con
`grep -n "EVENT_" app/Infrastructure/Persistence/Models/ServiceLogEventModel.php`).

En `apps/backend/app/Application/Services/ServiceLogEventRecorder.php`:

```php
    /**
     * El cliente se fue con el saldo pendiente. Sin este evento, la fila y la
     * lista de deudores dicen que debe pero nadie puede reconstruir quién lo
     * dejó salir ni cuándo.
     */
    public function leftOwing(ServiceLogModel $log, float $amount, ?string $actorId): void
    {
        $this->write($log, ServiceLogEventModel::EVENT_LEFT_OWING, [
            'amount' => $amount,
        ], $actorId);
    }
```

- [ ] **Step 4: Accept the flag when completing**

En `ServiceLogController::complete()`, después del guard de asignados y **antes** de `$this->serviceLogRepository->complete(...)`:

```php
        // "¿Cobrás ahora, o se va debiendo?" El cajero responde en el único
        // momento en que sabe la respuesta. Sin la marca, un impago sigue
        // siendo un pendiente del día — no un deudor.
        $pendiente = max(0.0, (float) $log->price_charged - $this->ledger->paidFor($log));
        $seVaDebiendo = $request->boolean('left_owing') && $pendiente > 0.005;

        if ($seVaDebiendo) {
            $log->forceFill(['left_owing' => true])->save();
            $this->events->leftOwing($log, $pendiente, $request->user()?->id);
        }
```

El `&& $pendiente > 0.005` es lo que impide un deudor de cero: marcar un
servicio saldado lo pondría en la lista debiendo nada.

- [ ] **Step 5: Expose the mark on the resource**

En `apps/backend/app/Infrastructure/Http/Resources/ServiceLogResource.php`, junto a
`'amount_due'`:

```php
            'left_owing'     => (bool) $this->left_owing,
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Debt/LeftOwingTest.php`
Expected: PASS — 5 passed

- [ ] **Step 7: Run every service-log test**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/ServiceLog/ tests/Feature/Debt/`
Expected: sólo el fallo pre-existente `ServiceLogTest > create service log requires required fields`.

- [ ] **Step 8: Commit**

```bash
git add apps/backend/app/Infrastructure/Http/Controllers/ServiceLog/ServiceLogController.php \
        apps/backend/app/Application/Services/ServiceLogEventRecorder.php \
        apps/backend/app/Infrastructure/Persistence/Models/ServiceLogEventModel.php \
        apps/backend/app/Infrastructure/Http/Resources/ServiceLogResource.php \
        apps/backend/tests/Feature/Debt/LeftOwingTest.php
git commit -m "feat(deuda): let the car leave owing, on purpose and on the record"
```

---

### Task 5: Los endpoints de la deuda

**Files:**
- Create: `apps/backend/app/Infrastructure/Http/Controllers/Debt/DebtController.php`
- Modify: `apps/backend/app/Infrastructure/Http/Controllers/ClientResource/ClientResourceController.php` (`index`)
- Modify: `apps/backend/app/Infrastructure/Http/Resources/ClientResourceResource.php`
- Modify: `apps/backend/routes/api.php`
- Test: `apps/backend/tests/Feature/Debt/DebtEndpointsTest.php`

**Interfaces:**
- Consumes: `DebtLedger` (Task 2), `PaymentLedger::recordAgainstResource` (Task 3).
- Produces:

```
GET  /api/v1/client-resources/{id}/debt   { total, items[], payments[] }
POST /api/v1/debts/manual                 { client_resource_id, amount, reason, incurred_on }
POST /api/v1/debts/payments               { client_resource_id, amount, method, bank?, allocations? }
GET  /api/v1/client-resources?with_debt=1&sort=debt
```

`ClientResourceResource` gana `debt` (float). Sale de `debtByResource`, calculado **una vez por página** y pasado al recurso; nunca una consulta por fila.

- [ ] **Step 1: Write the failing test**

```php
<?php
// apps/backend/tests/Feature/Debt/DebtEndpointsTest.php

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ManualDebtModel;
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

    $this->cliente = UserModel::factory()->create(['name' => 'Pablo Perez']);
    $service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->cliente->id, 'type' => 'sedan',
    ]);
    $this->sinDeuda = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->cliente->id, 'type' => 'sedan',
    ]);

    $this->debe = fn (float $price, string $date) => ServiceLogModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $this->resource->id,
        'service_id' => $service->id,
        'attended_by' => $this->owner->id,
        'created_by' => $this->owner->id,
        'price_charged' => $price,
        'payment_status' => 'unpaid',
        'paid_at' => null,
        'payment_method' => null,
        'left_owing' => true,
        'status' => 'completed',
        'log_date' => $date,
    ]);

    $this->as = fn () => $this->actingAs($this->owner)
        ->withHeader('X-Tenant', $this->tenant->slug);
});

test('the debt of a plate lists what makes it up, oldest first', function () {
    ($this->debe)(20.00, '2026-08-02');
    ManualDebtModel::create([
        'tenant_id' => $this->tenant->id, 'client_resource_id' => $this->resource->id,
        'amount' => 15.00, 'reason' => 'Cuaderno', 'incurred_on' => '2026-07-15',
    ]);

    ($this->as)()
        ->getJson("/api/v1/client-resources/{$this->resource->id}/debt")
        ->assertOk()
        ->assertJsonPath('data.total', 35)
        ->assertJsonPath('data.items.0.type', 'manual_debt')
        ->assertJsonPath('data.items.0.due', 15)
        ->assertJsonPath('data.items.1.type', 'service_log');
});

test('a plate with nothing owed reports zero, not an error', function () {
    ($this->as)()
        ->getJson("/api/v1/client-resources/{$this->sinDeuda->id}/debt")
        ->assertOk()
        ->assertJsonPath('data.total', 0)
        ->assertJsonPath('data.items', []);
});

test('the owner loads a debt from the notebook', function () {
    ($this->as)()
        ->postJson('/api/v1/debts/manual', [
            'client_resource_id' => $this->resource->id,
            'amount'             => 45.00,
            'reason'             => '3 lavados de julio',
            'incurred_on'        => '2026-07-15',
        ])
        ->assertStatus(201)
        ->assertJsonPath('data.amount', 45)
        ->assertJsonPath('data.incurred_on', '2026-07-15');

    ($this->as)()
        ->getJson("/api/v1/client-resources/{$this->resource->id}/debt")
        ->assertJsonPath('data.total', 45);
});

test('a manual debt needs a reason and a date', function () {
    // Una deuda sin motivo ni fecha no se puede defender frente al cliente.
    ($this->as)()
        ->postJson('/api/v1/debts/manual', [
            'client_resource_id' => $this->resource->id, 'amount' => 45.00,
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['reason', 'incurred_on']);
});

test('one payment settles the debt through the endpoint', function () {
    ($this->debe)(20.00, '2026-08-02');
    ($this->debe)(15.00, '2026-08-11');

    ($this->as)()
        ->postJson('/api/v1/debts/payments', [
            'client_resource_id' => $this->resource->id,
            'amount'             => 25.00,
            'method'             => 'cash',
        ])
        ->assertStatus(201)
        ->assertJsonPath('data.amount', 25);

    ($this->as)()
        ->getJson("/api/v1/client-resources/{$this->resource->id}/debt")
        ->assertJsonPath('data.total', 10);
});

test('the clients list carries each plate debt', function () {
    ($this->debe)(20.00, '2026-08-02');

    $res = ($this->as)()->getJson('/api/v1/client-resources?all=1')->assertOk();

    $conDeuda = collect($res->json('data'))->firstWhere('id', $this->resource->id);
    $sinDeuda = collect($res->json('data'))->firstWhere('id', $this->sinDeuda->id);

    expect((float) $conDeuda['debt'])->toBe(20.0);
    expect((float) $sinDeuda['debt'])->toBe(0.0);
});

test('the list can show only the ones who owe', function () {
    ($this->debe)(20.00, '2026-08-02');

    $ids = collect(
        ($this->as)()->getJson('/api/v1/client-resources?all=1&with_debt=1')->assertOk()->json('data')
    )->pluck('id')->all();

    expect($ids)->toBe([$this->resource->id]);
});

test('another tenants plate is not reachable', function () {
    $otro = TenantModel::factory()->create(['status' => 'active']);
    $intruso = UserModel::factory()->create();
    TenantUserModel::create([
        'id' => (string) Str::uuid(), 'tenant_id' => $otro->id,
        'user_id' => $intruso->id, 'role' => 'owner', 'is_active' => true,
    ]);

    $this->actingAs($intruso)->withHeader('X-Tenant', $otro->slug)
        ->getJson("/api/v1/client-resources/{$this->resource->id}/debt")
        ->assertStatus(404);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Debt/DebtEndpointsTest.php`
Expected: FAIL — 404 en las rutas nuevas.

- [ ] **Step 3: Write the controller**

```php
<?php
// apps/backend/app/Infrastructure/Http/Controllers/Debt/DebtController.php

declare(strict_types=1);

namespace App\Infrastructure\Http\Controllers\Debt;

use App\Application\Services\DebtLedger;
use App\Application\Services\PaymentLedger;
use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ManualDebtModel;
use App\Infrastructure\Persistence\Models\PaymentAllocationModel;
use App\Infrastructure\Persistence\Models\PaymentModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DebtController extends Controller
{
    public function __construct(
        private DebtLedger $debts,
        private PaymentLedger $ledger,
    ) {}

    /**
     * Qué debe una placa y de qué está hecha esa deuda. Devuelve también el
     * historial de pagos: la ficha tiene que poder responder "¿y qué me
     * pagó?" sin una segunda pantalla — y es la misma estructura que va a
     * consumir el estado de cuenta imprimible cuando exista.
     */
    public function show(string $id): JsonResponse
    {
        // findOrFail bajo el TenantScope: la placa de otro tenant es un 404.
        $resource = ClientResourceModel::findOrFail($id);
        $tenantId = app('current_tenant_id');

        $items = $this->debts->outstandingFor($tenantId, $resource->id);

        $pagos = PaymentModel::query()
            ->forTenant($tenantId)
            ->whereIn('id', PaymentAllocationModel::query()
                ->forTenant($tenantId)
                ->whereIn('payable_id', array_column($items, 'id'))
                ->select('payment_id'))
            ->orderByDesc('paid_at')
            ->get()
            ->map(fn (PaymentModel $p) => [
                'id'      => $p->id,
                'amount'  => (float) $p->amount,
                'method'  => $p->method,
                'paid_at' => $p->paid_at?->toIso8601String(),
            ]);

        return response()->json([
            'data' => [
                'client_resource_id' => $resource->id,
                'total'              => round(array_sum(array_column($items, 'due')), 2),
                'items'              => $items,
                'payments'           => $pagos,
            ],
        ]);
    }

    public function storeManual(Request $request): JsonResponse
    {
        $data = $request->validate([
            'client_resource_id' => ['required', 'uuid'],
            'amount'             => ['required', 'numeric', 'min:0.01'],
            // Una deuda sin motivo ni fecha no se puede defender frente al
            // cliente el día que la discute.
            'reason'             => ['required', 'string', 'max:200'],
            'incurred_on'        => ['required', 'date'],
        ]);

        $resource = ClientResourceModel::findOrFail($data['client_resource_id']);

        $debt = ManualDebtModel::create([
            'tenant_id'          => app('current_tenant_id'),
            'client_resource_id' => $resource->id,
            'client_id'          => $resource->client_id,
            'amount'             => $data['amount'],
            'reason'             => $data['reason'],
            'incurred_on'        => $data['incurred_on'],
            'created_by'         => $request->user()?->id,
        ]);

        return response()->json([
            'data' => [
                'id'          => $debt->id,
                'amount'      => (float) $debt->amount,
                'reason'      => $debt->reason,
                'incurred_on' => $debt->incurred_on?->toDateString(),
            ],
        ], 201);
    }

    public function storePayment(Request $request): JsonResponse
    {
        $data = $request->validate([
            'client_resource_id'    => ['required', 'uuid'],
            'amount'                => ['required', 'numeric', 'min:0.01'],
            'method'                => ['required', 'in:cash,card,transfer,other'],
            'bank'                  => ['nullable', 'string', 'max:40'],
            // Reparto corregido a mano. Ausente, se reparte del más viejo al
            // más nuevo.
            'allocations'           => ['sometimes', 'array'],
            'allocations.*.type'    => ['required', 'in:service_log,manual_debt'],
            'allocations.*.id'      => ['required', 'uuid'],
            'allocations.*.amount'  => ['required', 'numeric', 'min:0.01'],
        ]);

        $resource = ClientResourceModel::findOrFail($data['client_resource_id']);

        $payment = $this->ledger->recordAgainstResource(
            app('current_tenant_id'),
            $resource->id,
            (float) $data['amount'],
            $data['method'],
            $data['bank'] ?? null,
            $request->user()?->id,
            $data['allocations'] ?? [],
        );

        return response()->json([
            'data' => [
                'id'          => $payment->id,
                'amount'      => (float) $payment->amount,
                'method'      => $payment->method,
                'allocations' => $payment->allocations->map(fn ($a) => [
                    'type'   => $a->payable_type,
                    'id'     => $a->payable_id,
                    'amount' => (float) $a->amount,
                ]),
            ],
        ], 201);
    }
}
```

- [ ] **Step 4: Carry the debt on the clients list**

El método termina hoy con estas dos líneas:

```php
        $clientResources = $query->paginate($request->get('per_page', 15));

        return ClientResourceResource::collection($clientResources);
    }
```

Reemplazalas por:

```php
        // El saldo de TODAS las placas del tenant en dos consultas agregadas.
        // Una consulta por fila convertiría la pantalla del lunes en un
        // timeout con doscientos vehículos.
        $deudas = app(\App\Application\Services\DebtLedger::class)
            ->debtByResource(app('current_tenant_id'));

        // El toggle "Solo con deuda". El `?: ['-']` es lo que hace que un
        // tenant sin deudores devuelva vacío en vez de devolver todo.
        if ($request->boolean('with_debt')) {
            $query->whereIn('id', array_keys($deudas) ?: ['-']);
        }

        $clientResources = $query->paginate($request->get('per_page', 15));

        // El saldo viaja en el modelo, no en `meta`: el recurso lo lee sin
        // que el front tenga que cruzar dos estructuras.
        $clientResources->getCollection()->transform(function ($r) use ($deudas) {
            $r->setAttribute('debt_amount', (float) ($deudas[$r->id] ?? 0));
            return $r;
        });

        return ClientResourceResource::collection($clientResources);
    }
```

**No hay orden por deuda en SQL a propósito.** Hacerlo obligaría a arrastrar la
agregación a la consulta principal; con el filtro activo la lista son los
deudores, que son pocos, y la página se ordena en el navegador. Está dicho de
nuevo en la Task 7 para que nadie lo "arregle" desde el otro lado.

En `ClientResourceResource`, junto a `'created_at'`:

```php
            // Saldo de esta placa. Viene calculado en bloque desde el
            // controlador: nunca una consulta por fila.
            'debt' => (float) ($this->debt_amount ?? 0),
```

- [ ] **Step 5: Wire the routes**

En `apps/backend/routes/api.php`, junto a las otras rutas de `client-resources`
(alrededor de la línea 126):

```php
            // Deuda de una placa: de qué está hecha y qué se le pagó.
            Route::get('client-resources/{id}/debt', [DebtController::class, 'show']);
```

y en el mismo grupo de tenant donde viven `cash-sessions`:

```php
            // Deuda: la libreta del dueño y el cobro repartido.
            Route::post('debts/manual', [DebtController::class, 'storeManual']);
            Route::post('debts/payments', [DebtController::class, 'storePayment']);
```

más el import:

```php
use App\Infrastructure\Http\Controllers\Debt\DebtController;
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Debt/DebtEndpointsTest.php`
Expected: PASS — 8 passed

- [ ] **Step 7: Run the client-resource suite**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/ClientResource/ tests/Feature/Debt/`
Expected: los 5 fallos pre-existentes de `ClientResourceTest`, ni uno más.

- [ ] **Step 8: Commit**

```bash
git add apps/backend/app/Infrastructure/Http/Controllers/Debt/DebtController.php \
        apps/backend/app/Infrastructure/Http/Controllers/ClientResource/ClientResourceController.php \
        apps/backend/app/Infrastructure/Http/Resources/ClientResourceResource.php \
        apps/backend/routes/api.php \
        apps/backend/tests/Feature/Debt/DebtEndpointsTest.php
git commit -m "feat(deuda): endpoints for what is owed, the notebook, and the split payment"
```

---

### Task 6: La capa de datos del admin

**Files:**
- Create: `apps/admin-v2/src/domain/entities/debt.ts`
- Create: `apps/admin-v2/src/domain/repositories/debt.repository.ts`
- Create: `apps/admin-v2/src/infrastructure/api/repositories/api-debt.repository.ts`
- Create: `apps/admin-v2/src/application/use-cases/debt/get-debt.use-case.ts`
- Create: `apps/admin-v2/src/application/use-cases/debt/add-manual-debt.use-case.ts`
- Create: `apps/admin-v2/src/application/use-cases/debt/pay-debt.use-case.ts`
- Create: `apps/admin-v2/src/presentation/hooks/use-debt.ts`
- Modify: `apps/admin-v2/src/infrastructure/providers/repository.provider.tsx`
- Modify: `apps/admin-v2/src/domain/entities/client.ts` (o donde viva la entidad del recurso: `grep -rn "interface Client" src/domain/entities/`)
- Modify: el mapper del recurso (`grep -rn "labelFrom\|client-resource" src/infrastructure/api/mappers/`)

**Interfaces:**
- Consumes: los endpoints de la Task 5.
- Produces:

```ts
export type DebtItemType = 'service_log' | 'manual_debt';
export interface DebtItem {
  type: DebtItemType; id: string; label: string;
  date: string; amount: number; paid: number; due: number;
}
export interface DebtPaymentRecord { id: string; amount: number; method: string; paidAt: Date }
export interface Debt {
  clientResourceId: string; total: number;
  items: DebtItem[]; payments: DebtPaymentRecord[];
}
export interface DebtAllocationInput { type: DebtItemType; id: string; amount: number }

export function useDebt(clientResourceId: string, enabled: boolean)
export function useAddManualDebt()   // { clientResourceId, amount, reason, incurredOn }
export function usePayDebt()         // { clientResourceId, amount, method, bank?, allocations? }
```

Las dos mutaciones invalidan `['debt']`, `['clients']` **y** `['service-logs']`: cobrar una deuda cambia la ficha, la columna de la lista y la fila del día en que se registró el servicio.

Y la entidad del recurso gana `debt: number`.

- [ ] **Step 1: Write the entity**

```ts
// apps/admin-v2/src/domain/entities/debt.ts

/** De dónde sale una línea de deuda: un servicio que se fue sin pagar, o la
    libreta que el dueño llevaba antes del sistema. */
export type DebtItemType = 'service_log' | 'manual_debt';

export interface DebtItem {
  type: DebtItemType;
  id: string;
  label: string;
  /** Cuándo se generó la deuda, no cuándo se cargó. Es el orden del cobro. */
  date: string;
  amount: number;
  paid: number;
  due: number;
}

export interface DebtPaymentRecord {
  id: string;
  amount: number;
  method: string;
  paidAt: Date;
}

export interface Debt {
  clientResourceId: string;
  total: number;
  /** De la más vieja a la más nueva: ese orden ES el reparto por defecto. */
  items: DebtItem[];
  payments: DebtPaymentRecord[];
}

export interface DebtAllocationInput {
  type: DebtItemType;
  id: string;
  amount: number;
}

export interface AddManualDebtInput {
  clientResourceId: string;
  amount: number;
  reason: string;
  incurredOn: string;
}

export interface PayDebtInput {
  clientResourceId: string;
  amount: number;
  method: 'cash' | 'card' | 'transfer' | 'other';
  bank?: string | null;
  /** Ausente = reparto del más viejo al más nuevo. */
  allocations?: DebtAllocationInput[];
}

export const DEBT_ITEM_LABEL: Record<DebtItemType, string> = {
  service_log: 'Servicio',
  manual_debt: 'Cargado a mano',
};

/**
 * El reparto que el backend va a hacer, calculado en el navegador para
 * mostrarlo antes de confirmar. Tiene que dar el mismo resultado que
 * `DebtLedger::planFor`: mismo orden, mismo tope por línea.
 */
export function planFor(items: DebtItem[], amount: number): DebtAllocationInput[] {
  let left = Math.round(amount * 100) / 100;
  const plan: DebtAllocationInput[] = [];

  for (const item of items) {
    if (left <= 0.005) break;
    const applied = Math.min(left, item.due);
    plan.push({ type: item.type, id: item.id, amount: Math.round(applied * 100) / 100 });
    left = Math.round((left - applied) * 100) / 100;
  }

  return plan;
}
```

- [ ] **Step 2: Write the repository interface and its API implementation**

```ts
// apps/admin-v2/src/domain/repositories/debt.repository.ts

import type {
  Debt, AddManualDebtInput, PayDebtInput,
} from '@/domain/entities/debt';

/** Sin `remove`: una deuda cargada a mano se salda cobrándola, no borrándola.
    Borrarla dejaría el historial sin explicar por qué desapareció. */
export interface DebtRepository {
  get(clientResourceId: string): Promise<Debt>;
  addManual(input: AddManualDebtInput): Promise<void>;
  pay(input: PayDebtInput): Promise<void>;
}
```

```ts
// apps/admin-v2/src/infrastructure/api/repositories/api-debt.repository.ts

import api from '@/infrastructure/api/client';
import type {
  Debt, DebtItem, DebtItemType, AddManualDebtInput, PayDebtInput,
} from '@/domain/entities/debt';
import type { DebtRepository } from '@/domain/repositories/debt.repository';

type Raw = Record<string, unknown>;

function mapItem(raw: Raw): DebtItem {
  return {
    type: raw.type as DebtItemType,
    id: raw.id as string,
    label: raw.label as string,
    date: raw.date as string,
    amount: Number(raw.amount ?? 0),
    paid: Number(raw.paid ?? 0),
    due: Number(raw.due ?? 0),
  };
}

export class ApiDebtRepository implements DebtRepository {
  async get(clientResourceId: string): Promise<Debt> {
    const { data: res } = await api.get<{ data: Raw }>(
      `/client-resources/${clientResourceId}/debt`,
    );
    const d = res.data;
    return {
      clientResourceId: d.client_resource_id as string,
      total: Number(d.total ?? 0),
      items: ((d.items as Raw[]) ?? []).map(mapItem),
      payments: ((d.payments as Raw[]) ?? []).map((p) => ({
        id: p.id as string,
        amount: Number(p.amount ?? 0),
        method: p.method as string,
        paidAt: new Date(p.paid_at as string),
      })),
    };
  }

  async addManual(input: AddManualDebtInput): Promise<void> {
    await api.post('/debts/manual', {
      client_resource_id: input.clientResourceId,
      amount: input.amount,
      reason: input.reason,
      incurred_on: input.incurredOn,
    });
  }

  async pay(input: PayDebtInput): Promise<void> {
    await api.post('/debts/payments', {
      client_resource_id: input.clientResourceId,
      amount: input.amount,
      method: input.method,
      bank: input.bank ?? null,
      ...(input.allocations ? { allocations: input.allocations } : {}),
    });
  }
}
```

- [ ] **Step 3: Write the use cases**

```ts
// apps/admin-v2/src/application/use-cases/debt/get-debt.use-case.ts
import type { DebtRepository } from '@/domain/repositories/debt.repository';
import type { Debt } from '@/domain/entities/debt';

export class GetDebtUseCase {
  constructor(private repo: DebtRepository) {}
  execute(clientResourceId: string): Promise<Debt> {
    return this.repo.get(clientResourceId);
  }
}
```

```ts
// apps/admin-v2/src/application/use-cases/debt/add-manual-debt.use-case.ts
import type { DebtRepository } from '@/domain/repositories/debt.repository';
import type { AddManualDebtInput } from '@/domain/entities/debt';

export class AddManualDebtUseCase {
  constructor(private repo: DebtRepository) {}
  execute(input: AddManualDebtInput): Promise<void> {
    return this.repo.addManual(input);
  }
}
```

```ts
// apps/admin-v2/src/application/use-cases/debt/pay-debt.use-case.ts
import type { DebtRepository } from '@/domain/repositories/debt.repository';
import type { PayDebtInput } from '@/domain/entities/debt';

export class PayDebtUseCase {
  constructor(private repo: DebtRepository) {}
  execute(input: PayDebtInput): Promise<void> {
    return this.repo.pay(input);
  }
}
```

- [ ] **Step 4: Register the repository**

En `apps/admin-v2/src/infrastructure/providers/repository.provider.tsx`, siguiendo
el patrón de `cashSession`: el `import type`, el `import` de la implementación, la
clave `debt: DebtRepository;` en la interfaz `Repositories`, y
`debt: new ApiDebtRepository(),` en el `useMemo`.

- [ ] **Step 5: Write the hooks**

```ts
// apps/admin-v2/src/presentation/hooks/use-debt.ts
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/infrastructure/providers/repository.provider';
import { GetDebtUseCase } from '@/application/use-cases/debt/get-debt.use-case';
import { AddManualDebtUseCase } from '@/application/use-cases/debt/add-manual-debt.use-case';
import { PayDebtUseCase } from '@/application/use-cases/debt/pay-debt.use-case';
import type { AddManualDebtInput, PayDebtInput } from '@/domain/entities/debt';

export function useDebt(clientResourceId: string, enabled = true) {
  const repo = useRepository('debt');
  return useQuery({
    queryKey: ['debt', clientResourceId],
    queryFn: () => new GetDebtUseCase(repo).execute(clientResourceId),
    enabled: enabled && !!clientResourceId,
  });
}

/**
 * Las dos mutaciones invalidan tres cosas: la ficha de deuda, la columna de
 * la lista de Clientes, y la fila del Registro Diario del día en que se
 * registró el servicio — cobrar una deuda vieja la cambia de "Pendiente" a
 * pagada, y nadie debería tener que recargar para verlo.
 */
function useDebtMutation<TInput>(run: (input: TInput) => Promise<void>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['debt'] });
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['service-logs'] });
      qc.invalidateQueries({ queryKey: ['cash-session'] });
    },
  });
}

export function useAddManualDebt() {
  const repo = useRepository('debt');
  return useDebtMutation((input: AddManualDebtInput) =>
    new AddManualDebtUseCase(repo).execute(input),
  );
}

export function usePayDebt() {
  const repo = useRepository('debt');
  return useDebtMutation((input: PayDebtInput) =>
    new PayDebtUseCase(repo).execute(input),
  );
}
```

- [ ] **Step 6: Carry the debt on the client entity**

Buscá la entidad del recurso y su mapper:

```bash
cd apps/admin-v2
grep -rn "interface Client\b" src/domain/entities/
grep -rn "labelFrom\|client_resource\|clientResource" src/infrastructure/api/mappers/ | head
```

Agregá `debt: number;` a la entidad y, en el mapper, `debt: Number(raw.debt ?? 0)`.

- [ ] **Step 7: Typecheck**

Run: `cd apps/admin-v2 && npx tsc --noEmit`
Expected: sin errores. Correlo hasta el final.

- [ ] **Step 8: Commit**

```bash
git add apps/admin-v2/src/domain/entities/debt.ts \
        apps/admin-v2/src/domain/repositories/debt.repository.ts \
        apps/admin-v2/src/infrastructure/api/repositories/api-debt.repository.ts \
        apps/admin-v2/src/application/use-cases/debt/ \
        apps/admin-v2/src/presentation/hooks/use-debt.ts \
        apps/admin-v2/src/infrastructure/providers/repository.provider.tsx \
        apps/admin-v2/src/domain/entities/ \
        apps/admin-v2/src/infrastructure/api/mappers/
git commit -m "feat(deuda): admin data layer, with the split previewed in the browser"
```

---

### Task 7: Las pantallas

**Files:**
- Create: `apps/admin-v2/src/presentation/components/features/debt/debt-section.tsx`
- Create: `apps/admin-v2/src/presentation/components/features/debt/pay-debt-dialog.tsx`
- Create: `apps/admin-v2/src/presentation/components/features/debt/add-manual-debt-dialog.tsx`
- Create: `apps/admin-v2/src/presentation/components/features/service-logs/complete-service-dialog.tsx`
- Modify: `apps/admin-v2/src/presentation/app/(tenant)/clients/page.tsx`
- Modify: `apps/admin-v2/src/presentation/hooks/use-clients.ts` (gana el parámetro `withDebt`)
- Modify: `apps/admin-v2/src/presentation/components/features/clients/client-card.tsx`
- Modify: `apps/admin-v2/src/presentation/app/(tenant)/clients/[id]/page.tsx`
- Modify: `apps/admin-v2/src/presentation/components/features/service-logs/log-list.tsx`
- Modify: `apps/admin-v2/src/presentation/hooks/use-service-logs.ts` (`useCompleteServiceLog` acepta `leftOwing`)
- Modify: `apps/admin-v2/src/domain/entities/service-log.ts` y su mapper (`leftOwing`)

**Interfaces:**
- Consumes: `useDebt`, `usePayDebt`, `useAddManualDebt`, `planFor` (Task 6).
- Produces: nada que otro consuma.

Sin test automatizado: `admin-v2` no tiene tests de componentes. Se verifica en la Task 8, en el navegador.

- [ ] **Step 1: The debt badge and the filter in Clientes**

En `client-card.tsx`, cuando `client.debt > 0`, un chip ámbar junto al nombre:

```tsx
        {client.debt > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--warning-50)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--warning-700)] ring-1 ring-[var(--warning-200)]">
            <Wallet className="h-3 w-3" aria-hidden="true" />
            debe {fmt(client.debt)}
          </span>
        )}
```

(usá el mismo `Intl.NumberFormat('es-EC', …)` que el resto de la app — coma
decimal, no punto.)

En `clients/page.tsx`, un toggle y un orden, ambos en la URL con `nuqs` como hace
Registro Diario:

```tsx
  const [onlyDebt, setOnlyDebt] = useQueryState('with_debt', parseAsBoolean.withDefault(false));
```

Se lo pasás a `useClients` (que gana el parámetro y lo manda como `with_debt=1`),
y ordenás la página por saldo descendente cuando el toggle está activo:

```tsx
  const clients = useMemo(() => {
    const rows = data?.data ?? [];
    return onlyDebt ? [...rows].sort((a, b) => b.debt - a.debt) : rows;
  }, [data, onlyDebt]);
```

El orden es en memoria y **sobre la página**, no sobre el tenant: con el filtro
activo la lista son los deudores, que son pocos. Decirlo acá evita que alguien
lo "arregle" con un `ORDER BY` que obligue a arrastrar la agregación a la
consulta principal.

- [ ] **Step 2: The debt section on the client detail**

```tsx
// apps/admin-v2/src/presentation/components/features/debt/debt-section.tsx
'use client';

import { useState } from 'react';
import { Wallet } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { useDebt } from '@/presentation/hooks/use-debt';
import { PayDebtDialog } from '@/presentation/components/features/debt/pay-debt-dialog';
import { AddManualDebtDialog } from '@/presentation/components/features/debt/add-manual-debt-dialog';
import { DEBT_ITEM_LABEL } from '@/domain/entities/debt';

const money = (v: number) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(v);

export function DebtSection({ clientResourceId }: { clientResourceId: string }) {
  const { data, isLoading } = useDebt(clientResourceId);
  const [dialog, setDialog] = useState<'pay' | 'manual' | null>(null);

  if (isLoading) return <Skeleton className="h-32 w-full rounded-xl" />;

  const total = data?.total ?? 0;
  const items = data?.items ?? [];

  return (
    <>
      <section
        aria-label="Deuda"
        className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-[var(--fg-muted)]" aria-hidden="true" />
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
              Deuda
            </h2>
          </div>
          <span
            className={`text-[24px] font-bold tabular-nums ${
              total > 0 ? 'text-[var(--warning-700)]' : 'text-[var(--fg-strong)]'
            }`}
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {money(total)}
          </span>
        </div>

        {items.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {items.map((it) => (
              <li key={`${it.type}-${it.id}`} className="flex items-baseline gap-2 text-[13px]">
                <span className="w-[80px] shrink-0 tabular-nums text-[var(--fg-muted)]">
                  {it.date}
                </span>
                <span className="min-w-0 flex-1 truncate text-[var(--fg-strong)]">
                  {it.label}
                  {it.paid > 0 && (
                    <span className="ml-1.5 text-[11.5px] text-[var(--fg-muted)]">
                      abonado {money(it.paid)}
                    </span>
                  )}
                </span>
                <span className="shrink-0 tabular-nums font-semibold">{money(it.due)}</span>
                <span className="w-[110px] shrink-0 text-right text-[11.5px] text-[var(--fg-muted)]">
                  {DEBT_ITEM_LABEL[it.type]}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[13px] text-[var(--fg-secondary)]">Sin deuda pendiente.</p>
        )}

        <div className="mt-4 flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setDialog('manual')}>
            Cargar deuda
          </Button>
          {total > 0 && (
            <Button size="sm" onClick={() => setDialog('pay')}>
              Cobrar deuda
            </Button>
          )}
        </div>
      </section>

      <AddManualDebtDialog
        open={dialog === 'manual'}
        clientResourceId={clientResourceId}
        onClose={() => setDialog(null)}
      />
      {data && (
        <PayDebtDialog
          open={dialog === 'pay'}
          debt={data}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
```

Y renderizala en `clients/[id]/page.tsx`, arriba del historial. Leé el archivo
antes de editar para encontrar dónde arranca ese bloque; el id del recurso es el
de la ruta.

- [ ] **Step 3: The pay dialog, with the split shown before confirming**

```tsx
// apps/admin-v2/src/presentation/components/features/debt/pay-debt-dialog.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';
import { cn } from '@/shared/utils/cn';
import { usePayDebt } from '@/presentation/hooks/use-debt';
import { planFor, type Debt, type PayDebtInput } from '@/domain/entities/debt';

const money = (v: number) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(v);

const METHODS: { value: PayDebtInput['method']; label: string }[] = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'other', label: 'Otro' },
];

interface Props {
  open: boolean;
  debt: Debt;
  onClose: () => void;
}

/**
 * El reparto se muestra ANTES de confirmar, no después. Cobrar cuatro deudas
 * de a una es donde el cajero se equivoca; cobrarlas de un saque sin ver a
 * dónde fue cada dólar es donde se equivoca peor.
 */
export function PayDebtDialog({ open, debt, onClose }: Props) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PayDebtInput['method']>('cash');
  const mutation = usePayDebt();

  useEffect(() => {
    if (open) {
      setAmount(debt.total.toFixed(2));
      setMethod('cash');
    }
  }, [open, debt.total]);

  // El mismo reparto que va a hacer el backend, calculado acá para poder
  // mostrarlo. Si los dos divergen, el cajero ve una cosa y pasa otra.
  const plan = useMemo(
    () => planFor(debt.items, Number(amount) || 0),
    [debt.items, amount],
  );
  const aplicado = useMemo(
    () => plan.reduce((sum, p) => sum + p.amount, 0),
    [plan],
  );
  const sobra = Math.max(0, (Number(amount) || 0) - aplicado);

  async function submit() {
    const monto = Number(amount);
    if (!Number.isFinite(monto) || monto <= 0) {
      toast.error('Poné cuánto cobrás');
      return;
    }

    try {
      await mutation.mutateAsync({
        clientResourceId: debt.clientResourceId,
        amount: monto,
        method,
        allocations: plan,
      });
      toast.success('Deuda cobrada');
      onClose();
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      toast.error(msg ?? 'No se pudo cobrar la deuda');
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cobrar deuda</DialogTitle>
          <DialogDescription>
            Debe {money(debt.total)}. El cobro se aplica de la deuda más vieja a la más nueva.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="debt-amount">Monto</Label>
          <Input
            id="debt-amount"
            type="number"
            inputMode="decimal"
            min={0.01}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label>Método</Label>
          <div className="grid grid-cols-4 gap-2">
            {METHODS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMethod(m.value)}
                aria-pressed={method === m.value}
                className={cn(
                  'rounded-lg border px-2 py-2 text-[12.5px] font-medium transition-colors',
                  method === m.value
                    ? 'border-[var(--brand-500)] bg-[var(--brand-50)] text-[var(--brand-700)]'
                    : 'border-[var(--border)] hover:bg-[var(--bg-sunken)]',
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* El reparto. Es la razón de ser de este diálogo. */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-app)] p-3">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
            <span />
            <span className="text-right">Se abona</span>
            <span className="w-[70px] text-right">Queda</span>
          </div>
          <ul className="mt-1.5 space-y-1">
            {debt.items.map((it) => {
              const linea = plan.find((p) => p.type === it.type && p.id === it.id);
              const abona = linea?.amount ?? 0;
              return (
                <li
                  key={`${it.type}-${it.id}`}
                  className="grid grid-cols-[1fr_auto_auto] gap-x-3 text-[12.5px]"
                >
                  <span className="min-w-0 truncate">
                    <span className="tabular-nums text-[var(--fg-muted)]">{it.date}</span>{' '}
                    {it.label}
                  </span>
                  <span className="text-right tabular-nums font-semibold">{money(abona)}</span>
                  <span className="w-[70px] text-right tabular-nums text-[var(--fg-muted)]">
                    {money(it.due - abona)}
                  </span>
                </li>
              );
            })}
          </ul>
          {sobra > 0 && (
            <p className="mt-2 border-t border-[var(--border)] pt-2 text-[12px] text-[var(--fg-secondary)]">
              Sobran {money(sobra)}: quedan como saldo a favor del cliente.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Cobrando…' : 'Cobrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: The manual debt dialog**

```tsx
// apps/admin-v2/src/presentation/components/features/debt/add-manual-debt-dialog.tsx
'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';
import { useAddManualDebt } from '@/presentation/hooks/use-debt';

interface Props {
  open: boolean;
  clientResourceId: string;
  onClose: () => void;
}

/** Para pasar la libreta al sistema una vez y no volver a abrirla. */
export function AddManualDebtDialog({ open, clientResourceId, onClose }: Props) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [incurredOn, setIncurredOn] = useState('');
  const mutation = useAddManualDebt();

  useEffect(() => {
    if (open) {
      setAmount('');
      setReason('');
      setIncurredOn(new Date().toISOString().slice(0, 10));
    }
  }, [open]);

  async function submit() {
    const monto = Number(amount);
    if (!Number.isFinite(monto) || monto <= 0) {
      toast.error('Poné el monto de la deuda');
      return;
    }
    if (!reason.trim()) {
      // Una deuda sin motivo no se puede defender el día que el cliente la
      // discute.
      toast.error('Escribí de qué es la deuda');
      return;
    }

    try {
      await mutation.mutateAsync({
        clientResourceId,
        amount: monto,
        reason: reason.trim(),
        incurredOn,
      });
      toast.success('Deuda cargada');
      onClose();
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      toast.error(msg ?? 'No se pudo cargar la deuda');
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cargar deuda</DialogTitle>
          <DialogDescription>
            Una deuda que viene de antes del sistema. Se cobra igual que cualquier otra.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="manual-amount">Monto</Label>
          <Input
            id="manual-amount"
            type="number"
            inputMode="decimal"
            min={0.01}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="manual-reason">De qué es</Label>
          <Input
            id="manual-reason"
            maxLength={200}
            placeholder="3 lavados de julio, cuaderno"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="manual-date">Cuándo se generó</Label>
          <Input
            id="manual-date"
            type="date"
            value={incurredOn}
            onChange={(e) => setIncurredOn(e.target.value)}
          />
          <p className="text-[11.5px] text-[var(--fg-muted)]">
            No la fecha de hoy: la fecha real de la deuda. Es la que decide el orden del cobro.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Cargando…' : 'Cargar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: Completar pregunta si se va debiendo**

```tsx
// apps/admin-v2/src/presentation/components/features/service-logs/complete-service-dialog.tsx
'use client';

import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';

const money = (v: number) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(v);

interface Props {
  open: boolean;
  amountDue: number;
  pending: boolean;
  onCharge: () => void;
  onLeaveOwing: () => void;
  onClose: () => void;
}

/**
 * Completar con saldo pendiente es el único momento en que alguien sabe si
 * esto es una deuda o un olvido. Se pregunta acá, una vez, y la respuesta
 * queda en la bitácora.
 */
export function CompleteServiceDialog({
  open, amountDue, pending, onCharge, onLeaveOwing, onClose,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Faltan {money(amountDue)}</DialogTitle>
          <DialogDescription>
            El servicio está listo pero no está pagado del todo. ¿Cobrás ahora, o se lleva
            el vehículo debiendo?
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="outline" onClick={onLeaveOwing} disabled={pending}>
            Se va debiendo
          </Button>
          <Button onClick={onCharge} disabled={pending}>
            Cobrar ahora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

En `log-list.tsx`, `handleComplete` deja de completar directo cuando falta plata:

```tsx
  function handleComplete(log: ServiceLog) {
    // Con saldo pendiente hay una pregunta que hacer antes de cerrar.
    if (log.amountDue > 0.005) {
      setCompleteTarget(log);
      return;
    }
    completeMutation.mutate(log.id);
  }
```

con su `useState<ServiceLog | null>(null)` y el diálogo renderizado abajo, junto a
los otros:

```tsx
      {completeTarget && (
        <CompleteServiceDialog
          open
          amountDue={completeTarget.amountDue}
          pending={completeMutation.isPending}
          onCharge={() => {
            setPayTarget(completeTarget);
            setCompleteTarget(null);
          }}
          onLeaveOwing={() =>
            completeMutation.mutate(
              { id: completeTarget.id, leftOwing: true },
              { onSuccess: () => setCompleteTarget(null) },
            )
          }
          onClose={() => setCompleteTarget(null)}
        />
      )}
```

La mutación de completar gana el parámetro: buscá `useCompleteServiceLog` en
`use-service-logs.ts` y hacé que acepte `{ id, leftOwing? }`, mandando
`left_owing` en el body. Mantené la firma vieja funcionando si algún otro
llamador pasa sólo el id.

Y la fila lo grita: en la celda PAGO, cuando `log.leftOwing`, el badge dice
**Debe** en vez de Pendiente. Agregá `leftOwing: boolean` a la entidad y al
mapper (`left_owing`), igual que en la fase 3.

- [ ] **Step 6: El mostrador avisa la deuda vieja**

El spec lo pide y es el momento en que se puede cobrar: al abrir el diálogo de
cobro de un servicio cuya placa ya debe de antes, decirlo.

En `register-payment-dialog.tsx`, la prop `serviceLogId` viene acompañada de la
placa. Agregá `clientResourceId?: string` a `Props`, pedí la deuda sólo mientras
el diálogo está abierto, y descontá **este** servicio de la cifra —lo que se
está por cobrar no es "deuda de antes":

```tsx
  const { data: debt } = useDebt(clientResourceId ?? '', open && !!clientResourceId);
  const previa = (debt?.items ?? [])
    .filter((it) => it.id !== serviceLogId)
    .reduce((sum, it) => sum + it.due, 0);
```

y arriba de los botones:

```tsx
        {previa > 0 && (
          <p className="rounded-lg bg-[var(--warning-50)] px-3 py-2 text-[12.5px] font-medium text-[var(--warning-700)] ring-1 ring-[var(--warning-200)]">
            Además debe {money(previa)} de antes.
          </p>
        )}
```

En `log-list.tsx`, pasale `clientResourceId={payTarget.clientResourceId}` al
diálogo. Si la entidad `ServiceLog` no expone el id del recurso (sólo el objeto
`clientResource`), usá `payTarget.clientResource?.id` — verificalo con
`grep -n "clientResource" src/domain/entities/service-log.ts` antes de escribirlo.

- [ ] **Step 7: Typecheck and build**

Run: `cd apps/admin-v2 && npx tsc --noEmit && npm run build`
Expected: ambos verdes. Correlos hasta el final.

- [ ] **Step 8: Commit**

```bash
git add apps/admin-v2/src/presentation/components/features/debt/ \
        apps/admin-v2/src/presentation/components/features/service-logs/ \
        apps/admin-v2/src/presentation/components/features/clients/ \
        "apps/admin-v2/src/presentation/app/(tenant)/clients/" \
        apps/admin-v2/src/presentation/hooks/use-service-logs.ts \
        apps/admin-v2/src/domain/entities/service-log.ts \
        apps/admin-v2/src/infrastructure/api/mappers/service-log.mapper.ts
git commit -m "feat(deuda): the Monday screen, the debt card, and the question at completion"
```

---

### Task 8: Verificación de la fase

**Files:** ninguno. Es la corrida que decide si la fase se puede desplegar.

- [ ] **Step 1: Full backend suite**

Run: `cd apps/backend && composer test`
Expected: **exactamente los 9 fallos pre-existentes**. El verde sube de 473 a **509** (36 tests nuevos: 6 + 10 + 7 + 5 + 8). Anotá el número real.

- [ ] **Step 2: Migrations from scratch on MySQL**

```bash
cd apps/backend
mysql -h127.0.0.1 -uroot -e "DROP DATABASE IF EXISTS turnly_scratch; CREATE DATABASE turnly_scratch;"
DB_DATABASE=turnly_scratch php artisan migrate:fresh
mysql -h127.0.0.1 -uroot -e "DROP DATABASE turnly_scratch;"
```
Expected: todas limpias. **Sin `--seed`**: el seeder está roto de antes.

- [ ] **Step 3: The MySQL-only suites**

```bash
cd apps/backend
mysql -h127.0.0.1 -uroot -e "DROP DATABASE IF EXISTS turnly_test; CREATE DATABASE turnly_test;"
DB_CONNECTION=mysql DB_DATABASE=turnly_test php artisan migrate --force
DB_CONNECTION=mysql DB_DATABASE=turnly_test ./vendor/bin/pest tests/Feature/Report/ tests/Feature/Payment/ tests/Feature/Cash/ tests/Feature/Debt/
mysql -h127.0.0.1 -uroot -e "DROP DATABASE turnly_test;"
```
Expected: verde, sin saltados. **`DebtLedger::debtByResource` usa subconsultas
en un `leftJoin`, que es donde SQLite y MySQL más difieren** — si algo se rompe
sólo acá, es eso.

- [ ] **Step 4: Admin builds**

Run: `cd apps/admin-v2 && npx tsc --noEmit && npm run build`
Expected: ambos verdes.

- [ ] **Step 5: La escena completa, en el navegador**

Con el stack levantado, en un tenant car_wash:

1. Registrá un servicio de **$30** cobrando **$10** (abono de la fase 3).
2. Tocá **Completar**. Aparece el diálogo: **«Faltan $20,00 · ¿Cobrás ahora, o se lleva el vehículo debiendo?»**
3. Elegí **Se va debiendo**. El servicio queda completado y la fila dice **Debe**.
4. Andá a **Clientes**. La placa muestra el chip **debe $20,00**.
5. Activá **Solo con deuda**: quedan sólo los deudores, ordenados por saldo.
6. Abrí la ficha de esa placa. La sección **Deuda** muestra $20,00 y la línea del servicio.
7. **Cargar deuda**: $15,00, «3 lavados de julio», fecha **2026-07-15**. La deuda pasa a **$35,00** y la línea de julio queda **primera** — antes que el servicio de hoy.
8. **Cobrar deuda** por **$20,00**. El reparto muestra: julio se abona $15 y queda $0; el servicio se abona $5 y queda $15.
9. Confirmá. La deuda queda en **$15,00**, y el tile de EFECTIVO del Registro Diario subió **$20**.
10. Si la caja está abierta, cerrala: el esperado incluye esos $20.

- [ ] **Step 6: El olvido no es deuda**

Registrá un servicio «cobrar al retirar» y **completalo eligiendo Cobrar ahora → Cancelar** (o completalo desde la app móvil, que no manda la marca). Tiene que quedar **pendiente del día y NO aparecer en Clientes como deudor**. Es el criterio que hace creíble la lista.

- [ ] **Step 7: Report**

Contá qué pasó en cada paso, con el número de tests del paso 1 y las cifras del reparto del paso 8.

---

## Notas de ejecución

**Rama.** Esta fase se apoya en las fases 1, 2 y 3, que hoy viven sin desplegar en `feat/registro-bitacora-asignados`. Seguí ahí salvo que el usuario decida otra cosa.

**Lo que esta fase deliberadamente NO hace:**
- **Límite de crédito, intereses, recordatorios y estado de cuenta imprimible.** El spec tiene una sección con dónde encaja cada uno y qué no hay que hacer ahora para no bloquearlos. La única obligación que impone: la consulta de deuda vive en `DebtLedger` y devuelve la composición completa. Los cuatro la reusan.
- No toca reservas: `payable_type = 'reservation'` sigue reservado y sin usar.
- No resuelve el **efectivo huérfano de la caja**. Sigue abierto desde la fase 2, y ahora importa más: un descuadre con dos causas posibles no se diagnostica.
- No permite borrar una deuda manual. Se salda cobrándola; borrarla dejaría el historial sin explicar por qué desapareció.

**Si la lista de Clientes se pone lenta.** Es un N+1 en la deuda. El test `debt by resource costs two queries, not one per row` existe para que eso no llegue a producción — si alguien lo relajó, ahí está la causa.

**Si un total de deuda no cierra.** Casi siempre es un `left_owing` sin marcar o un servicio marcado que ya se pagó. Los dos se ven de una:

```bash
php artisan tinker --execute='
use App\Infrastructure\Persistence\Models\ServiceLogModel as L;
dump(L::withoutGlobalScopes()->where("left_owing", true)->get(["id","price_charged","payment_status"])->toArray());'
```
