# Libro de pagos (fase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mover el pago fuera de la fila del servicio a un libro propio (`payments` + `payment_allocations`), sin que el usuario note un solo cambio, para que la caja del día, los abonos y la deuda de clientes puedan construirse encima.

**Architecture:** Dos tablas nuevas y un servicio de aplicación único que las escribe. Las columnas de pago que hoy viven en `service_logs` sobreviven como **derivadas**: se recalculan desde el libro en cada cobro, así que todo lo que ya las lee (filtros, tiles, reportes, facturación) sigue funcionando. Una migración de backfill convierte cada servicio pagado de hoy en un pago del libro, de modo que los números históricos se reproducen exactos.

**Tech Stack:** Laravel 13 (Domain → Application → Infrastructure), Pest + SQLite en memoria para tests, MySQL en local.

**Spec:** `docs/superpowers/specs/2026-08-18-libro-de-pagos-caja-abono-deuda-design.md`

## Global Constraints

- **Nada cambia para el usuario en esta fase.** Si una pantalla se ve distinta o un número cambia, es un defecto. El criterio de éxito es que la suite entera pase y los totales del día sean idénticos antes y después.
- **`payments.amount` es lo que entró, nunca el precio del servicio.** Confundirlos es exactamente el bug que este libro existe para eliminar.
- **Los saldos no se almacenan.** `payment_status` es derivada y se recalcula; no se escribe a mano en ningún lado fuera del servicio de aplicación.
- **`payment_allocations` es polimórfica** (`payable_type` + `payable_id`) desde el día uno. Valores válidos en esta fase: `service_log`. `reservation` queda reservado y sin usar.
- **La suma de asignaciones de un pago nunca supera su monto.** Lo que sobra es saldo a favor del cliente.
- Modelos en `app/Infrastructure/Persistence/Models/`, no en `app/Models/`. Todo modelo con tenant usa `use HasUuids, BelongsToTenant;`.
- Servicios de aplicación en `app/Application/Services/`.
- `config()` y no `env()` en código de aplicación (producción cachea config).
- Tests: `cd apps/backend && ./vendor/bin/pest <ruta>`.
- **La suite tiene 9 fallos PRE-EXISTENTES** (5 en `ClientResourceTest`, 3 en `ReservationInvoiceTest`, 1 en `ServiceLogTest > create service log requires required fields`). No son tuyos. No los arregles, no los cuentes como regresión.
- **Desviación deliberada del spec:** `payments.cash_session_id` **no** se crea en esta fase. Su FK apunta a `cash_sessions`, que nace en la fase 2 junto con la caja. Agregarla ahí es una migración de una línea; crearla ahora sería una FK a una tabla inexistente.

---

### Task 1: Tablas y modelos del libro

**Files:**
- Create: `apps/backend/database/migrations/2026_08_19_100001_create_payments_table.php`
- Create: `apps/backend/database/migrations/2026_08_19_100002_create_payment_allocations_table.php`
- Create: `apps/backend/database/migrations/2026_08_19_100003_widen_payment_status_on_service_logs.php`
- Create: `apps/backend/app/Infrastructure/Persistence/Models/PaymentModel.php`
- Create: `apps/backend/app/Infrastructure/Persistence/Models/PaymentAllocationModel.php`
- Test: `apps/backend/tests/Feature/Payment/PaymentModelTest.php`

**Interfaces:**
- Consumes: nada.
- Produces: `PaymentModel` (`$fillable = ['tenant_id','client_id','amount','method','bank','paid_at','received_by','notes']`, relación `allocations()`), `PaymentAllocationModel` (`$fillable = ['tenant_id','payment_id','payable_type','payable_id','amount']`, relación `payment()`), y las constantes `PaymentAllocationModel::PAYABLE_SERVICE_LOG = 'service_log'` y `PAYABLE_RESERVATION = 'reservation'`.

- [ ] **Step 1: Write the failing test**

```php
<?php
// apps/backend/tests/Feature/Payment/PaymentModelTest.php

use App\Infrastructure\Persistence\Models\PaymentAllocationModel;
use App\Infrastructure\Persistence\Models\PaymentModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);
    $this->user = UserModel::factory()->create();
});

test('a payment records what came in, with its method and who took it', function () {
    $p = PaymentModel::create([
        'tenant_id'   => $this->tenant->id,
        'client_id'   => null,
        'amount'      => 5.00,
        'method'      => 'cash',
        'bank'        => null,
        'paid_at'     => now(),
        'received_by' => $this->user->id,
    ]);

    expect((float) $p->fresh()->amount)->toBe(5.0);
    expect($p->method)->toBe('cash');
    expect($p->received_by)->toBe($this->user->id);
});

test('an allocation says how much of a payment cancels which service', function () {
    $p = PaymentModel::create([
        'tenant_id' => $this->tenant->id, 'amount' => 20.00, 'method' => 'cash',
        'paid_at' => now(), 'received_by' => $this->user->id,
    ]);

    $a = PaymentAllocationModel::create([
        'tenant_id'    => $this->tenant->id,
        'payment_id'   => $p->id,
        'payable_type' => PaymentAllocationModel::PAYABLE_SERVICE_LOG,
        'payable_id'   => (string) \Illuminate\Support\Str::uuid(),
        'amount'       => 12.50,
    ]);

    expect((float) $a->fresh()->amount)->toBe(12.5);
    expect($p->fresh()->allocations)->toHaveCount(1);
});

test('the tenant scope hides another tenants payments', function () {
    $other = TenantModel::factory()->create(['status' => 'active']);
    PaymentModel::create([
        'tenant_id' => $other->id, 'amount' => 1, 'method' => 'cash',
        'paid_at' => now(), 'received_by' => $this->user->id,
    ]);
    PaymentModel::create([
        'tenant_id' => $this->tenant->id, 'amount' => 2, 'method' => 'cash',
        'paid_at' => now(), 'received_by' => $this->user->id,
    ]);

    expect(PaymentModel::count())->toBe(1);
    expect((float) PaymentModel::first()->amount)->toBe(2.0);
});

test('payment_status on a service log accepts partial', function () {
    // La columna era enum('unpaid','paid'). El abono la necesita ancha, y
    // ensancharla ahora evita una migración en medio de esa feature.
    $col = \Illuminate\Support\Facades\Schema::getColumnType('service_logs', 'payment_status');
    expect($col)->toBeIn(['string', 'varchar']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Payment/PaymentModelTest.php`
Expected: FAIL — `Class "App\Infrastructure\Persistence\Models\PaymentModel" not found`

- [ ] **Step 3: Write the payments migration**

```php
<?php
// apps/backend/database/migrations/2026_08_19_100001_create_payments_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Cada vez que entra plata. El pago vivía dentro de la fila del servicio,
     * lo que hacía imposible dos pagos contra un servicio (abono) o un pago
     * contra varios (deuda) — y hacía que la caja del día contara precios de
     * servicios en vez de plata recibida.
     *
     * `amount` es lo que ENTRÓ, nunca el precio del servicio.
     *
     * `cash_session_id` no está acá a propósito: su tabla nace con la caja,
     * en la fase siguiente.
     */
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            // Null = walk-in sin cliente identificado, que es la mayoría.
            $table->uuid('client_id')->nullable();
            $table->decimal('amount', 12, 2);
            $table->string('method', 20);
            $table->string('bank', 40)->nullable();
            $table->timestamp('paid_at');
            $table->uuid('received_by')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->foreign('client_id')->references('id')->on('users')->nullOnDelete();
            $table->foreign('received_by')->references('id')->on('users')->nullOnDelete();

            $table->index(['tenant_id', 'paid_at']);
            $table->index(['client_id', 'paid_at']);
            $table->index(['tenant_id', 'method', 'paid_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
```

- [ ] **Step 4: Write the allocations migration**

```php
<?php
// apps/backend/database/migrations/2026_08_19_100002_create_payment_allocations_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Contra qué se aplica cada pago. Polimórfica desde el día uno:
     * `reservations` arrastra el mismo problema y va a entrar después, y
     * agregarle polimorfismo más tarde obliga a un backfill de filas ya
     * escritas.
     *
     * Invariante que el servicio de aplicación sostiene: la suma de las
     * asignaciones de un pago nunca supera su monto. Lo que sobra es saldo a
     * favor del cliente.
     */
    public function up(): void
    {
        Schema::create('payment_allocations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('payment_id');
            $table->string('payable_type', 30);
            $table->uuid('payable_id');
            $table->decimal('amount', 12, 2);
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->foreign('payment_id')->references('id')->on('payments')->cascadeOnDelete();

            // La consulta caliente: "cuánto se pagó de este servicio".
            $table->index(['payable_type', 'payable_id']);
            $table->index(['tenant_id', 'payable_type', 'payable_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_allocations');
    }
};
```

- [ ] **Step 5: Widen payment_status**

```php
<?php
// apps/backend/database/migrations/2026_08_19_100003_widen_payment_status_on_service_logs.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * `payment_status` era enum('unpaid','paid'). El abono necesita 'partial'.
     *
     * Pasa a string(20) en vez de a un enum más ancho por la misma razón por
     * la que `service_staff.position` es string: SQLite (los tests) no sabe
     * alterar enums, y la próxima vez que haga falta un valor nuevo esto
     * volvería a ser una migración imposible de correr en test. La validación
     * vive en el request y en el servicio de aplicación.
     */
    public function up(): void
    {
        Schema::table('service_logs', function (Blueprint $table) {
            $table->string('payment_status', 20)->default('unpaid')->change();
        });
    }

    public function down(): void
    {
        Schema::table('service_logs', function (Blueprint $table) {
            $table->enum('payment_status', ['unpaid', 'paid'])->default('unpaid')->change();
        });
    }
};
```

- [ ] **Step 6: Write the models**

```php
<?php
// apps/backend/app/Infrastructure/Persistence/Models/PaymentModel.php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Models;

use App\Infrastructure\Persistence\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Plata que entró. Ver el spec: es el cimiento de la caja del día, los abonos
 * y la deuda de clientes.
 */
class PaymentModel extends Model
{
    use HasUuids, BelongsToTenant;

    protected $table = 'payments';

    public const METHODS = ['cash', 'card', 'transfer', 'other'];

    protected $fillable = [
        'tenant_id', 'client_id', 'amount', 'method', 'bank',
        'paid_at', 'received_by', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'amount'  => 'decimal:2',
            'paid_at' => 'datetime',
        ];
    }

    public function allocations(): HasMany
    {
        return $this->hasMany(PaymentAllocationModel::class, 'payment_id');
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(UserModel::class, 'client_id');
    }

    public function receiver(): BelongsTo
    {
        return $this->belongsTo(UserModel::class, 'received_by');
    }

    /** Lo que todavía no se aplicó a nada: saldo a favor del cliente. */
    public function unallocatedAmount(): float
    {
        return (float) $this->amount - (float) $this->allocations()->sum('amount');
    }
}
```

```php
<?php
// apps/backend/app/Infrastructure/Persistence/Models/PaymentAllocationModel.php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Models;

use App\Infrastructure\Persistence\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Qué parte de un pago cancela qué servicio. */
class PaymentAllocationModel extends Model
{
    use HasUuids, BelongsToTenant;

    protected $table = 'payment_allocations';

    public const PAYABLE_SERVICE_LOG = 'service_log';
    public const PAYABLE_RESERVATION = 'reservation';

    protected $fillable = [
        'tenant_id', 'payment_id', 'payable_type', 'payable_id', 'amount',
    ];

    protected function casts(): array
    {
        return ['amount' => 'decimal:2'];
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(PaymentModel::class, 'payment_id');
    }
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Payment/PaymentModelTest.php`
Expected: PASS — 4 passed

- [ ] **Step 8: Verify the enum change survives MySQL**

Run: `cd apps/backend && php artisan migrate`
Expected: las tres migraciones corren limpias sobre MySQL local. SQLite no prueba el `->change()` de un enum; MySQL sí. Si falla, reportalo — NO lo resuelvas borrando y recreando la columna, que perdería los valores.

- [ ] **Step 9: Commit**

```bash
git add apps/backend/database/migrations/2026_08_19_1000*.php \
        apps/backend/app/Infrastructure/Persistence/Models/PaymentModel.php \
        apps/backend/app/Infrastructure/Persistence/Models/PaymentAllocationModel.php \
        apps/backend/tests/Feature/Payment/PaymentModelTest.php
git commit -m "feat(pagos): a ledger for money that came in, separate from the service it paid"
```

---

### Task 2: `PaymentLedger`, el único que escribe el libro

**Files:**
- Create: `apps/backend/app/Application/Services/PaymentLedger.php`
- Test: `apps/backend/tests/Feature/Payment/PaymentLedgerTest.php`

**Interfaces:**
- Consumes: `PaymentModel`, `PaymentAllocationModel` (Task 1).
- Produces:

```php
recordForServiceLog(
    ServiceLogModel $log,
    float $amount,
    string $method,
    ?string $bank,
    ?string $receivedBy,
    ?\DateTimeInterface $paidAt = null,
    ?string $notes = null,
): PaymentModel

paidFor(ServiceLogModel $log): float
statusFor(ServiceLogModel $log): string            // unpaid | partial | paid
syncLogPaymentState(ServiceLogModel $log): void    // recalcula las columnas derivadas
```

Un servicio de aplicación y no un método en el controlador: los cinco puntos que van a escribir pagos (cobro diferido, cobro al registrar, abono, pago de deuda, backfill) tienen que producir exactamente la misma forma, y la única manera de garantizarlo es que haya un solo lugar que la escriba.

- [ ] **Step 1: Write the failing test**

```php
<?php
// apps/backend/tests/Feature/Payment/PaymentLedgerTest.php

use App\Application\Services\PaymentLedger;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\PaymentModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    $this->user = UserModel::factory()->create();
    $service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id, 'price' => 15.00]);
    $resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->user->id, 'type' => 'sedan',
    ]);

    $this->log = fn (float $price = 15.00) => ServiceLogModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $resource->id,
        'service_id' => $service->id,
        'attended_by' => $this->user->id,
        'created_by' => $this->user->id,
        'price_charged' => $price,
        'payment_status' => 'unpaid',
        'paid_at' => null,
        'payment_method' => null,
    ]);

    $this->ledger = app(PaymentLedger::class);
});

test('a full payment leaves the log paid', function () {
    $log = ($this->log)(15.00);

    $this->ledger->recordForServiceLog($log, 15.00, 'cash', null, $this->user->id);

    expect($this->ledger->paidFor($log))->toBe(15.0);
    expect($this->ledger->statusFor($log))->toBe('paid');
    expect($log->fresh()->payment_status)->toBe('paid');
    expect($log->fresh()->payment_method)->toBe('cash');
    expect($log->fresh()->paid_at)->not->toBeNull();
});

test('a partial payment leaves the log partial', function () {
    // El abono de la fase 3 ya funciona a nivel de libro: sólo falta la UI.
    $log = ($this->log)(15.00);

    $this->ledger->recordForServiceLog($log, 5.00, 'cash', null, $this->user->id);

    expect($this->ledger->paidFor($log))->toBe(5.0);
    expect($this->ledger->statusFor($log))->toBe('partial');
    expect($log->fresh()->payment_status)->toBe('partial');
});

test('two payments add up and close the log', function () {
    $log = ($this->log)(15.00);

    $this->ledger->recordForServiceLog($log, 5.00, 'cash', null, $this->user->id);
    $this->ledger->recordForServiceLog($log, 10.00, 'transfer', 'pichincha', $this->user->id);

    expect($this->ledger->paidFor($log))->toBe(15.0);
    expect($this->ledger->statusFor($log))->toBe('paid');
    // Las columnas derivadas reflejan el ÚLTIMO pago, que es lo que la fila
    // de la lista muestra.
    expect($log->fresh()->payment_method)->toBe('transfer');
    expect($log->fresh()->payment_bank)->toBe('pichincha');
});

test('a payment writes exactly one allocation against its service', function () {
    $log = ($this->log)(15.00);

    $p = $this->ledger->recordForServiceLog($log, 15.00, 'cash', null, $this->user->id);

    expect($p->allocations)->toHaveCount(1);
    expect($p->allocations->first()->payable_id)->toBe($log->id);
    expect($p->allocations->first()->payable_type)->toBe('service_log');
    expect($p->unallocatedAmount())->toBe(0.0);
});

test('an unpaid log reports zero, not null', function () {
    $log = ($this->log)(15.00);

    expect($this->ledger->paidFor($log))->toBe(0.0);
    expect($this->ledger->statusFor($log))->toBe('unpaid');
});

test('a payment carries the client of the service', function () {
    // La deuda de la fase 4 se apoya en esto: sin client_id no hay saldo.
    $log = ($this->log)(15.00);

    $p = $this->ledger->recordForServiceLog($log, 15.00, 'cash', null, $this->user->id);

    expect($p->client_id)->toBe($this->user->id);
});

test('a payment of more than the total does not overshoot the allocation', function () {
    // Cobrar $20 por un servicio de $15 deja $5 a favor del cliente, no un
    // servicio "pagado de más".
    $log = ($this->log)(15.00);

    $p = $this->ledger->recordForServiceLog($log, 20.00, 'cash', null, $this->user->id);

    expect((float) $p->allocations->first()->amount)->toBe(15.0);
    expect($p->unallocatedAmount())->toBe(5.0);
    expect($this->ledger->statusFor($log))->toBe('paid');
});

test('cents do not break the paid check', function () {
    // 0.1 + 0.2 en float no es 0.3. Un servicio de $0,30 pagado en dos veces
    // tiene que quedar pagado igual.
    $log = ($this->log)(0.30);

    $this->ledger->recordForServiceLog($log, 0.10, 'cash', null, $this->user->id);
    $this->ledger->recordForServiceLog($log, 0.20, 'cash', null, $this->user->id);

    expect($this->ledger->statusFor($log))->toBe('paid');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Payment/PaymentLedgerTest.php`
Expected: FAIL — `Class "App\Application\Services\PaymentLedger" not found`

- [ ] **Step 3: Write the ledger**

```php
<?php
// apps/backend/app/Application/Services/PaymentLedger.php

declare(strict_types=1);

namespace App\Application\Services;

use App\Infrastructure\Persistence\Models\PaymentAllocationModel;
use App\Infrastructure\Persistence\Models\PaymentModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use Illuminate\Support\Facades\DB;

/**
 * El único lugar que escribe el libro de pagos.
 *
 * Cinco caminos van a cobrar plata — cobro diferido, cobro al registrar,
 * abono, pago de deuda y el backfill — y todos tienen que producir la misma
 * forma. Un método por camino en cinco controladores distintos es cómo se
 * termina con tres variantes de "pago" que no se pueden sumar entre sí.
 */
class PaymentLedger
{
    /**
     * Los montos redondean a centavos antes de compararse: 0.1 + 0.2 en float
     * no da 0.3, y un servicio pagado en dos partes tiene que cerrar igual.
     */
    private const CENT = 0.005;

    public function recordForServiceLog(
        ServiceLogModel $log,
        float $amount,
        string $method,
        ?string $bank,
        ?string $receivedBy,
        ?\DateTimeInterface $paidAt = null,
        ?string $notes = null,
    ): PaymentModel {
        return DB::transaction(function () use ($log, $amount, $method, $bank, $receivedBy, $paidAt, $notes) {
            $payment = PaymentModel::create([
                'tenant_id'   => $log->tenant_id,
                'client_id'   => $log->clientResource?->client_id,
                'amount'      => $amount,
                'method'      => $method,
                'bank'        => $method === 'transfer' ? $bank : null,
                'paid_at'     => $paidAt ?? now(),
                'received_by' => $receivedBy,
                'notes'       => $notes,
            ]);

            // Se asigna hasta lo que falta, no todo el pago: cobrar de más
            // deja saldo a favor del cliente, no un servicio sobrepagado.
            $pending   = max(0.0, (float) $log->price_charged - $this->paidFor($log));
            $allocated = min($amount, $pending);

            if ($allocated > 0) {
                PaymentAllocationModel::create([
                    'tenant_id'    => $log->tenant_id,
                    'payment_id'   => $payment->id,
                    'payable_type' => PaymentAllocationModel::PAYABLE_SERVICE_LOG,
                    'payable_id'   => $log->id,
                    'amount'       => $allocated,
                ]);
            }

            $this->syncLogPaymentState($log);

            return $payment->fresh('allocations');
        });
    }

    /**
     * Cuánto se pagó de este servicio, sumando todas sus asignaciones.
     *
     * `forTenant($log->tenant_id)` y no el scope ambiente: el libro también se
     * escribe desde jobs, que corren sin `current_tenant_id` bindeado. Es el
     * patrón que el propio trait recomienda para no depender del contenedor.
     */
    public function paidFor(ServiceLogModel $log): float
    {
        return (float) PaymentAllocationModel::query()
            ->forTenant($log->tenant_id)
            ->where('payable_type', PaymentAllocationModel::PAYABLE_SERVICE_LOG)
            ->where('payable_id', $log->id)
            ->sum('amount');
    }

    public function statusFor(ServiceLogModel $log): string
    {
        $paid  = $this->paidFor($log);
        $total = (float) $log->price_charged;

        if ($paid <= self::CENT) {
            return 'unpaid';
        }

        return $paid + self::CENT >= $total ? 'paid' : 'partial';
    }

    /**
     * Recalcula las columnas que viven en la fila del servicio. Siguen ahí
     * porque los filtros de la lista, los tiles y la facturación las leen —
     * pero ya no son la verdad, son un reflejo del libro.
     */
    public function syncLogPaymentState(ServiceLogModel $log): void
    {
        $status = $this->statusFor($log);

        $last = PaymentModel::query()
            ->forTenant($log->tenant_id)
            ->whereIn('id', PaymentAllocationModel::query()
                ->forTenant($log->tenant_id)
                ->where('payable_type', PaymentAllocationModel::PAYABLE_SERVICE_LOG)
                ->where('payable_id', $log->id)
                ->select('payment_id'))
            ->orderByDesc('paid_at')
            ->orderByDesc('created_at')
            ->first();

        $log->forceFill([
            'payment_status' => $status,
            'payment_method' => $last?->method,
            'payment_bank'   => $last?->bank,
            'paid_at'        => $last?->paid_at,
        ])->save();
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Payment/PaymentLedgerTest.php`
Expected: PASS — 8 passed

- [ ] **Step 5: Commit**

```bash
git add apps/backend/app/Application/Services/PaymentLedger.php \
        apps/backend/tests/Feature/Payment/PaymentLedgerTest.php
git commit -m "feat(pagos): one writer for the ledger, so five callers cannot invent five shapes"
```

---

### Task 3: Backfill — la historia entra al libro

**Files:**
- Create: `apps/backend/database/migrations/2026_08_19_100004_backfill_payments_from_service_logs.php`
- Test: `apps/backend/tests/Feature/Payment/PaymentBackfillTest.php`

**Interfaces:**
- Consumes: `payments`, `payment_allocations` (Task 1).
- Produces: nada nuevo en código. Deja el libro con un pago por cada servicio que hoy figura pagado.

La migración **no usa `PaymentLedger`**: una migración que depende de un servicio de aplicación se rompe el día que ese servicio cambia de firma, y las migraciones viejas tienen que poder correr para siempre. Escribe con `DB::table()` directo.

- [ ] **Step 1: Write the failing test**

```php
<?php
// apps/backend/tests/Feature/Payment/PaymentBackfillTest.php

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\PaymentAllocationModel;
use App\Infrastructure\Persistence\Models\PaymentModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    $this->user = UserModel::factory()->create();
    $service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->user->id, 'type' => 'sedan',
    ]);

    $this->log = fn (array $attrs) => ServiceLogModel::factory()->create(array_merge([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $this->resource->id,
        'service_id' => $service->id,
        'attended_by' => $this->user->id,
        'created_by' => $this->user->id,
    ], $attrs));

    // La migración de backfill ya corrió en el setup de la suite, así que se
    // la vuelve a invocar a mano sobre las filas que este test crea.
    $this->runBackfill = function () {
        $migration = require base_path('database/migrations/2026_08_19_100004_backfill_payments_from_service_logs.php');
        $migration->up();
    };
});

test('a paid service becomes one payment for its full price', function () {
    $log = ($this->log)([
        'price_charged' => 12.50, 'payment_status' => 'paid',
        'payment_method' => 'cash', 'paid_at' => now()->subDay(),
    ]);

    ($this->runBackfill)();

    $payment = PaymentModel::withoutGlobalScopes()->first();
    expect((float) $payment->amount)->toBe(12.5);
    expect($payment->method)->toBe('cash');
    expect($payment->received_by)->toBe($this->user->id);
    expect($payment->paid_at->toDateString())->toBe(now()->subDay()->toDateString());

    $alloc = PaymentAllocationModel::withoutGlobalScopes()->first();
    expect($alloc->payable_id)->toBe($log->id);
    expect((float) $alloc->amount)->toBe(12.5);
});

test('an unpaid service produces no payment', function () {
    ($this->log)([
        'price_charged' => 12.50, 'payment_status' => 'unpaid',
        'payment_method' => null, 'paid_at' => null,
    ]);

    ($this->runBackfill)();

    expect(PaymentModel::withoutGlobalScopes()->count())->toBe(0);
});

test('the backfill is idempotent', function () {
    // Correrla dos veces no puede duplicar la historia: una migración se
    // vuelve a correr más seguido de lo que uno cree.
    ($this->log)([
        'price_charged' => 12.50, 'payment_status' => 'paid',
        'payment_method' => 'cash', 'paid_at' => now(),
    ]);

    ($this->runBackfill)();
    ($this->runBackfill)();

    expect(PaymentModel::withoutGlobalScopes()->count())->toBe(1);
});

test('the collected total is identical before and after', function () {
    // El criterio de éxito de toda la fase: los números no cambian.
    foreach ([['cash', 10.00], ['card', 25.50], ['transfer', 8.25]] as [$method, $price]) {
        ($this->log)([
            'price_charged' => $price, 'payment_status' => 'paid',
            'payment_method' => $method, 'paid_at' => now(),
        ]);
    }
    ($this->log)(['price_charged' => 99.00, 'payment_status' => 'unpaid', 'paid_at' => null]);

    $antes = (float) ServiceLogModel::withoutGlobalScopes()
        ->where('payment_status', 'paid')->sum('price_charged');

    ($this->runBackfill)();

    $despues = (float) PaymentModel::withoutGlobalScopes()->sum('amount');

    expect($despues)->toBe($antes);
    expect($despues)->toBe(43.75);
});

test('a paid service with no method falls back to cash', function () {
    // Filas viejas con method null existen. Sin un valor, el pago quedaría
    // fuera de todo agrupamiento por método y la caja perdería plata.
    ($this->log)([
        'price_charged' => 5.00, 'payment_status' => 'paid',
        'payment_method' => null, 'paid_at' => now(),
    ]);

    ($this->runBackfill)();

    expect(PaymentModel::withoutGlobalScopes()->first()->method)->toBe('cash');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Payment/PaymentBackfillTest.php`
Expected: FAIL — `failed to open stream` sobre el archivo de migración, que todavía no existe

- [ ] **Step 3: Write the backfill migration**

```php
<?php
// apps/backend/database/migrations/2026_08_19_100004_backfill_payments_from_service_logs.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Cada servicio que hoy figura pagado se convierte en un pago del libro,
     * por su precio completo, con su método, su fecha y quien lo atendió como
     * quien lo cobró. Después de esto, sumar `payments.amount` da exactamente
     * lo mismo que sumaba `service_logs.price_charged` de los pagados — que es
     * el criterio de éxito de toda la fase.
     *
     * No usa PaymentLedger a propósito: una migración tiene que poder correr
     * dentro de cinco años, y para entonces la firma de ese servicio va a
     * haber cambiado. Escribe con DB::table() y se sostiene sola.
     *
     * Idempotente: sólo toma servicios que todavía no tienen asignación.
     */
    public function up(): void
    {
        $yaMigrados = DB::table('payment_allocations')
            ->where('payable_type', 'service_log')
            ->pluck('payable_id')
            ->all();

        $query = DB::table('service_logs')
            ->where('payment_status', 'paid')
            ->whereNotNull('price_charged');

        if ($yaMigrados !== []) {
            $query->whereNotIn('id', $yaMigrados);
        }

        $ahora = now();

        $query->orderBy('id')->chunkById(500, function ($logs) use ($ahora) {
            $pagos = [];
            $asignaciones = [];

            foreach ($logs as $log) {
                $paymentId = (string) Str::uuid();
                $monto = (float) $log->price_charged;

                $pagos[] = [
                    'id'          => $paymentId,
                    'tenant_id'   => $log->tenant_id,
                    // El cliente sale del recurso; una subconsulta por fila
                    // sería lenta en una tabla grande, así que se resuelve
                    // abajo en bloque.
                    'client_id'   => null,
                    'amount'      => $monto,
                    // Filas viejas sin método: efectivo es el default histórico
                    // de la columna y el caso real de una lavadora.
                    'method'      => $log->payment_method ?: 'cash',
                    'bank'        => $log->payment_bank,
                    'paid_at'     => $log->paid_at ?? $log->created_at ?? $ahora,
                    'received_by' => $log->attended_by,
                    'notes'       => null,
                    'created_at'  => $ahora,
                    'updated_at'  => $ahora,
                ];

                $asignaciones[] = [
                    'id'           => (string) Str::uuid(),
                    'tenant_id'    => $log->tenant_id,
                    'payment_id'   => $paymentId,
                    'payable_type' => 'service_log',
                    'payable_id'   => $log->id,
                    'amount'       => $monto,
                    'created_at'   => $ahora,
                    'updated_at'   => $ahora,
                ];
            }

            foreach (array_chunk($pagos, 200) as $bloque) {
                DB::table('payments')->insert($bloque);
            }
            foreach (array_chunk($asignaciones, 200) as $bloque) {
                DB::table('payment_allocations')->insert($bloque);
            }
        });

        // client_id en bloque: un UPDATE con join en vez de una subconsulta
        // por fila.
        DB::table('payments')
            ->whereNull('client_id')
            ->whereExists(function ($q) {
                $q->select(DB::raw(1))
                    ->from('payment_allocations')
                    ->whereColumn('payment_allocations.payment_id', 'payments.id');
            })
            ->update([
                'client_id' => DB::raw('(
                    SELECT cr.client_id
                    FROM payment_allocations pa
                    JOIN service_logs sl ON sl.id = pa.payable_id
                    JOIN client_resources cr ON cr.id = sl.client_resource_id
                    WHERE pa.payment_id = payments.id
                      AND pa.payable_type = \'service_log\'
                    LIMIT 1
                )'),
            ]);
    }

    /**
     * Sólo borra lo que este backfill creó: pagos cuya única asignación
     * apunta a un service_log. Un rollback que vacíe la tabla se llevaría
     * también los cobros hechos después de migrar.
     */
    public function down(): void
    {
        $ids = DB::table('payment_allocations')
            ->where('payable_type', 'service_log')
            ->pluck('payment_id')
            ->all();

        if ($ids === []) {
            return;
        }

        DB::table('payments')->whereIn('id', $ids)->delete();
    }
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Payment/PaymentBackfillTest.php`
Expected: PASS — 5 passed

- [ ] **Step 5: Run it against real data**

Run: `cd apps/backend && php artisan migrate`

Después, comprobá a mano que los totales coinciden:

```bash
php artisan tinker --execute='
$pagados = App\Infrastructure\Persistence\Models\ServiceLogModel::withoutGlobalScopes()->where("payment_status","paid")->sum("price_charged");
$libro   = App\Infrastructure\Persistence\Models\PaymentModel::withoutGlobalScopes()->sum("amount");
echo "servicios pagados: $pagados".PHP_EOL;
echo "libro de pagos:    $libro".PHP_EOL;
echo ($pagados == $libro ? "COINCIDEN" : "NO COINCIDEN").PHP_EOL;'
```

Expected: COINCIDEN. Si no, **no sigas** — reportalo con los dos números.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/database/migrations/2026_08_19_100004_backfill_payments_from_service_logs.php \
        apps/backend/tests/Feature/Payment/PaymentBackfillTest.php
git commit -m "feat(pagos): move history into the ledger, reproducing every total exactly"
```

---

### Task 4: Los cobros escriben en el libro

**Files:**
- Modify: `apps/backend/app/Infrastructure/Http/Controllers/ServiceLog/ServiceLogController.php` (`__construct`, `store`, `recordPayment`)
- Test: `apps/backend/tests/Feature/Payment/PaymentWiringTest.php`

**Interfaces:**
- Consumes: `PaymentLedger` (Task 2).
- Produces: nada nuevo. A partir de acá todo cobro nace en el libro y las columnas del servicio son reflejo.

**Contexto del controlador que la tarea toca:**
- `store()` arma un array `$patch` y hace `ServiceLogModel::where('id', ...)->update($patch)`. Dentro de ese array setea `payment_status`, `paid_at`, `payment_method` y `payment_bank` según `$request->get('payment_status', 'paid')`.
- Justo después llama `$this->events->created(...)` y, si el log quedó pagado, `$this->events->paymentRecorded(...)`.
- `recordPayment()` hace `$log->update([...])` con método, banco, estado y `paid_at`, y después llama `$this->events->paymentRecorded(...)`.
- El recorder de bitácora (`ServiceLogEventRecorder`) ya está inyectado como `$this->events`. **No lo toques**: los eventos siguen escribiéndose igual.

- [ ] **Step 1: Write the failing test**

```php
<?php
// apps/backend/tests/Feature/Payment/PaymentWiringTest.php

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\PaymentAllocationModel;
use App\Infrastructure\Persistence\Models\PaymentModel;
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
        'tenant_id' => $this->tenant->id, 'price' => 10.00,
    ]);
    $this->resource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id, 'client_id' => $this->owner->id, 'type' => 'sedan',
    ]);

    $this->as = fn (UserModel $u) => $this->actingAs($u)
        ->withHeader('X-Tenant', $this->tenant->slug);

    $this->register = fn (array $extra = []) => ($this->as)($this->owner)
        ->postJson('/api/v1/service-logs', array_merge([
            'client_resource_id' => $this->resource->id,
            'attended_by'        => $this->owner->id,
            'items'              => [[
                'service_id' => $this->service->id, 'label' => 'Lavado',
                'qty' => 1, 'unit_price' => 10.00,
            ]],
            'payment_method' => 'cash',
        ], $extra));
});

test('registering a service paid at the counter writes a payment', function () {
    $id = ($this->register)()->json('data.id');

    $payment = PaymentModel::withoutGlobalScopes()->first();
    expect((float) $payment->amount)->toBe(10.0);
    expect($payment->method)->toBe('cash');
    expect($payment->received_by)->toBe($this->owner->id);

    $alloc = PaymentAllocationModel::withoutGlobalScopes()->first();
    expect($alloc->payable_id)->toBe($id);
});

test('registering to be paid later writes no payment', function () {
    ($this->register)(['payment_status' => 'unpaid']);

    expect(PaymentModel::withoutGlobalScopes()->count())->toBe(0);
});

test('collecting later writes the payment and closes the log', function () {
    $id = ($this->register)(['payment_status' => 'unpaid'])->json('data.id');

    ($this->as)($this->owner)
        ->postJson("/api/v1/service-logs/{$id}/payment", [
            'method' => 'transfer', 'bank' => 'pichincha',
        ])
        ->assertOk();

    $payment = PaymentModel::withoutGlobalScopes()->first();
    expect((float) $payment->amount)->toBe(10.0);
    expect($payment->method)->toBe('transfer');
    expect($payment->bank)->toBe('pichincha');

    expect(\App\Infrastructure\Persistence\Models\ServiceLogModel::withoutGlobalScopes()
        ->find($id)->payment_status)->toBe('paid');
});

test('the log columns still mirror the payment', function () {
    // Los filtros de la lista, los tiles y la facturación las leen. Si dejan
    // de reflejar el libro, todo eso miente sin avisar.
    $id = ($this->register)()->json('data.id');

    $log = \App\Infrastructure\Persistence\Models\ServiceLogModel::withoutGlobalScopes()->find($id);
    expect($log->payment_status)->toBe('paid');
    expect($log->payment_method)->toBe('cash');
    expect($log->paid_at)->not->toBeNull();
});

test('the trail still records the payment', function () {
    // La bitácora es una feature aparte y no debe romperse al mover el pago.
    $id = ($this->register)()->json('data.id');

    $eventos = \App\Infrastructure\Persistence\Models\ServiceLogEventModel::withoutGlobalScopes()
        ->where('service_log_id', $id)->pluck('event')->all();

    expect($eventos)->toContain('payment_recorded');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Payment/PaymentWiringTest.php`
Expected: FAIL — el primer test falla porque `PaymentModel::first()` es null

- [ ] **Step 3: Inject the ledger**

En `ServiceLogController::__construct`, agregá el parámetro al final y su import
`use App\Application\Services\PaymentLedger;`:

```php
        private PaymentLedger $ledger,
```

- [ ] **Step 4: Rewire `store()`**

Localizá el bloque que arma `$patch` para el pago. Dejá que siga escribiendo el
estado **unpaid** como hoy, pero sacá de ahí el camino de "pagado": el estado
pagado ahora lo produce el libro.

Reemplazá el `else` del `if ($paymentStatus === 'unpaid')` por nada — es decir,
el `$patch` sólo setea columnas de pago cuando el servicio queda impago:

```php
        if ($paymentStatus === 'unpaid') {
            $patch['payment_status'] = 'unpaid';
            $patch['paid_at'] = null;
            $patch['payment_method'] = null;
            $patch['payment_bank'] = null;
        }
```

Después, donde hoy dice
`if ($logModel->payment_status === 'paid') { $this->events->paymentRecorded(...); }`,
poné el cobro **antes** del evento:

```php
        // Cobrar al registrar es un cobro: entra al libro como cualquier otro.
        if ($paymentStatus !== 'unpaid') {
            $this->ledger->recordForServiceLog(
                $logModel,
                (float) $logModel->price_charged,
                (string) $request->payment_method,
                $request->payment_bank,
                $request->user()?->id,
            );
            $logModel->refresh();

            $this->events->paymentRecorded(
                $logModel,
                (string) $logModel->payment_method,
                $logModel->payment_bank,
                (float) $logModel->price_charged,
                $request->user()?->id,
            );
        }
```

- [ ] **Step 5: Rewire `recordPayment()`**

Reemplazá el `$log->update([...])` que setea método, banco, estado y `paid_at`
por una llamada al libro. Las notas con la referencia siguen igual:

```php
        $this->ledger->recordForServiceLog(
            $log,
            (float) $log->price_charged,
            $data['method'],
            $data['bank'] ?? null,
            $request->user()?->id,
        );

        // La referencia sigue yendo a notas: service_logs no tiene columna
        // propia para ella y el caso típico no la usa.
        if (!empty($data['reference'])) {
            $log->update([
                'notes' => trim(($log->notes ?? '') . "\nRef: {$data['reference']}") ?: null,
            ]);
        }

        $log->refresh();
```

El resto del método — el guard de `ALREADY_PAID`, el evento de bitácora y la
respuesta — queda igual.

- [ ] **Step 6: Run the payment tests**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Payment/`
Expected: PASS — 22 passed (4 + 8 + 5 + 5)

- [ ] **Step 7: Run every service-log test**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/ServiceLog/`
Expected: sólo el fallo pre-existente `ServiceLogTest > create service log requires required fields`. **Si rompe otro, no lo arregles editando su assert** — es la señal de que el recableado cambió un comportamiento que alguien esperaba. Diagnosticá y reportá.

- [ ] **Step 8: Commit**

```bash
git add apps/backend/app/Infrastructure/Http/Controllers/ServiceLog/ServiceLogController.php \
        apps/backend/tests/Feature/Payment/PaymentWiringTest.php
git commit -m "feat(pagos): every collection now starts in the ledger"
```

---

### Task 5: Los totales del día salen del libro

**Files:**
- Modify: `apps/backend/app/Infrastructure/Persistence/Repositories/EloquentServiceLogRepository.php` (`getDailySummary`, alrededor de la línea 67)
- Test: `apps/backend/tests/Feature/Payment/DailySummaryFromLedgerTest.php`

**Interfaces:**
- Consumes: `payments`, `payment_allocations` (Task 1), backfill (Task 3).
- Produces: `by_payment_method` y `collected` calculados sobre montos de pagos.

**Por qué importa ahora y no en la fase del abono:** los tiles suman
`price_charged` de los servicios cuyo método es X. Mientras todo pago sea
completo eso coincide con la plata recibida, pero el día del abono empieza a
mentir — un servicio de $15 con $5 cobrados sumaría $15 al tile de efectivo.
Cambiar la fuente ahora, con el backfill recién hecho, permite probar que los
números son **idénticos**; hacerlo después mezcla el cambio de fuente con el
cambio de comportamiento y ya no se sabe cuál movió el número.

**Cuidado con la fecha.** `getDailySummary` filtra servicios por `log_date`. Los
pagos se filtran por `paid_at`: un servicio del lunes cobrado el martes es plata
del martes. Esa diferencia es intencional y es la que hace que la caja cuadre.

- [ ] **Step 1: Write the failing test**

```php
<?php
// apps/backend/tests/Feature/Payment/DailySummaryFromLedgerTest.php

use App\Application\Services\PaymentLedger;
use App\Domain\ServiceLog\Contracts\ServiceLogRepositoryInterface;
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

    $this->log = fn (float $price, string $date) => ServiceLogModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_resource_id' => $resource->id,
        'service_id' => $service->id,
        'attended_by' => $this->user->id,
        'created_by' => $this->user->id,
        'price_charged' => $price,
        'payment_status' => 'unpaid',
        'paid_at' => null,
        'payment_method' => null,
        'log_date' => $date,
    ]);

    $this->ledger = app(PaymentLedger::class);
    $this->repo   = app(ServiceLogRepositoryInterface::class);
});

test('the cash tile sums money received, not service prices', function () {
    $hoy = now()->toDateString();
    $log = ($this->log)(15.00, $hoy);

    // Abono de $5: al cajón entraron $5, no $15.
    $this->ledger->recordForServiceLog($log, 5.00, 'cash', null, $this->user->id);

    $summary = $this->repo->getDailySummary($this->tenant->id, $hoy);

    expect($summary['by_payment_method']['cash']['total'])->toBe(5.0);
});

test('each method lands in its own tile', function () {
    $hoy = now()->toDateString();
    $a = ($this->log)(10.00, $hoy);
    $b = ($this->log)(20.00, $hoy);

    $this->ledger->recordForServiceLog($a, 10.00, 'cash', null, $this->user->id);
    $this->ledger->recordForServiceLog($b, 20.00, 'transfer', 'pichincha', $this->user->id);

    $summary = $this->repo->getDailySummary($this->tenant->id, $hoy);

    expect($summary['by_payment_method']['cash']['total'])->toBe(10.0);
    expect($summary['by_payment_method']['transfer']['total'])->toBe(20.0);
    expect($summary['by_payment_method']['card']['total'])->toBe(0.0);
});

test('money follows the day it was collected, not the day of the service', function () {
    // Un lavado del lunes cobrado el martes es plata del martes. Sin esto la
    // caja del martes nunca cuadraría.
    $ayer = now()->subDay()->toDateString();
    $hoy  = now()->toDateString();

    $log = ($this->log)(12.00, $ayer);
    $this->ledger->recordForServiceLog($log, 12.00, 'cash', null, $this->user->id, now());

    expect($this->repo->getDailySummary($this->tenant->id, $ayer)['by_payment_method']['cash']['total'])->toBe(0.0);
    expect($this->repo->getDailySummary($this->tenant->id, $hoy)['by_payment_method']['cash']['total'])->toBe(12.0);
});

test('collected counts what came in', function () {
    $hoy = now()->toDateString();
    $log = ($this->log)(15.00, $hoy);
    $this->ledger->recordForServiceLog($log, 5.00, 'cash', null, $this->user->id);

    expect($this->repo->getDailySummary($this->tenant->id, $hoy)['collected']['total'])->toBe(5.0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Payment/DailySummaryFromLedgerTest.php`
Expected: FAIL — el primer test da `15.0` en vez de `5.0`: está sumando el precio del servicio

- [ ] **Step 3: Rewire the summary**

En `getDailySummary`, reemplazá el bloque que arma `$byPaymentMethod` (hoy
recorre los métodos filtrando `$rows`) por una consulta al libro, y recalculá
`collected` sobre lo mismo. Leé el método entero antes de editar: `$rows`,
`$reservations` y `$byStatus` siguen igual.

```php
        // Los tiles cuentan plata recibida, no precios de servicios. Con
        // abonos parciales esas dos cifras dejan de coincidir, y la que le
        // importa a la caja es la primera. Se filtra por `paid_at`: un
        // servicio de ayer cobrado hoy es plata de hoy.
        $pagosDelDia = \App\Infrastructure\Persistence\Models\PaymentModel::query()
            ->forTenant($tenantId)
            ->whereDate('paid_at', $date)
            ->get();

        $byPaymentMethod = [];
        foreach (['cash', 'card', 'transfer', 'other'] as $method) {
            $subset = $pagosDelDia->where('method', $method);
            $byPaymentMethod[$method] = [
                'count' => $subset->count(),
                'total' => (float) $subset->sum('amount'),
            ];
        }
```

Y en el `return`, cambiá `collected`:

```php
            'collected'          => [
                'count' => $pagosDelDia->count() + $paidReservations->count(),
                'total' => (float) $pagosDelDia->sum('amount')
                    + (float) $paidReservations->sum($reservationPrice),
            ],
```

`unpaid`, `total_revenue`, `total_washes` y `by_status` **no cambian**: siguen
describiendo servicios del día, no plata.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Payment/DailySummaryFromLedgerTest.php`
Expected: PASS — 4 passed

- [ ] **Step 5: Prove the numbers did not move**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/ServiceLog/`
Expected: sólo el fallo pre-existente. Los tests viejos del summary tienen que
seguir verdes **sin editarlos**: con pagos completos, sumar montos y sumar
precios da lo mismo, y esa es la prueba de que el backfill fue fiel.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/app/Infrastructure/Persistence/Repositories/EloquentServiceLogRepository.php \
        apps/backend/tests/Feature/Payment/DailySummaryFromLedgerTest.php
git commit -m "feat(pagos): the day's tiles count money received, not prices charged"
```

---

### Task 6: Los reportes salen del libro

**Files:**
- Modify: `apps/backend/app/Infrastructure/Http/Controllers/Report/ReportController.php:49-53` (método `daily()`)
- Test: `apps/backend/tests/Feature/Payment/ReportsFromLedgerTest.php`

**Interfaces:**
- Consumes: `PaymentModel` (Task 1).
- Produces: nada nuevo.

Mismo agrupamiento que los tiles, un nivel más arriba: hoy
`$washLogs->where('payment_method', 'cash')->sum('price_charged')`. Dejarlo
así después de cambiar los tiles deja dos fuentes de verdad para la misma
pregunta, que es cómo se termina con un reporte que no coincide con la pantalla
de la que salió.

- [ ] **Step 1: Write the failing test**

```php
<?php
// apps/backend/tests/Feature/Payment/ReportsFromLedgerTest.php

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
});

test('the report groups money received by method', function () {
    $a = ($this->log)(15.00);
    $this->ledger->recordForServiceLog($a, 5.00, 'cash', null, $this->owner->id);

    $hoy = now()->toDateString();

    $res = $this->actingAs($this->owner)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson("/api/v1/reports/daily?date={$hoy}")
        ->assertOk();

    // $5 entraron, no $15.
    expect((float) $res->json('data.washes.by_payment_method.cash'))->toBe(5.0);
});
```

El endpoint es `GET /api/v1/reports/daily?date=YYYY-MM-DD` y el método vive en
`ReportController::daily()`. La cifra por método cuelga de
`data.washes.by_payment_method.cash` — anidada bajo `washes`, no en la raíz de
`data`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Payment/ReportsFromLedgerTest.php`
Expected: FAIL — devuelve 15.0

- [ ] **Step 3: Rewire the report**

Reemplazá las cuatro líneas que suman `price_charged` por método por una
consulta al libro, en el mismo rango de fechas que ya usa el reporte:

En `daily()`, después de la línea `$serviceRevenue = (float) $washLogs->sum('price_charged');`,
agregá:

```php
        // Plata recibida por método, del libro de pagos. Sumar price_charged
        // por método miente en cuanto existe un abono. `$date` y `$tenantId`
        // ya están declarados arriba en este mismo método.
        $pagosDelDia = \App\Infrastructure\Persistence\Models\PaymentModel::query()
            ->forTenant($tenantId)
            ->whereDate('paid_at', $date)
            ->get();
```

y reemplazá el bloque `'by_payment_method' => [...]` (líneas 49-53) por:

```php
                    'by_payment_method' => [
                        'cash'     => (float) $pagosDelDia->where('method', 'cash')->sum('amount'),
                        'card'     => (float) $pagosDelDia->where('method', 'card')->sum('amount'),
                        'transfer' => (float) $pagosDelDia->where('method', 'transfer')->sum('amount'),
                    ],
```

Los otros métodos del controlador (`range`, `weekly`, `monthly`) y el filtro
`?payment_method=` **no se tocan en esta tarea**: filtrar la lista de servicios
por su método es una pregunta distinta de sumar plata, y la columna derivada
sigue reflejando el último pago. Si `range` resulta tener el mismo bloque
`by_payment_method`, reportalo — es una tarea aparte, no un agregado silencioso
a ésta.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Payment/ReportsFromLedgerTest.php`
Expected: PASS

- [ ] **Step 5: Run the reports suite**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Report/`
Expected: verde. Si un test viejo rompe, mirá si esperaba precios en vez de
plata cobrada — y si es así, es el test el que estaba describiendo el bug.
Reportalo antes de tocarlo.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/app/Infrastructure/Http/Controllers/Report/ReportController.php \
        apps/backend/tests/Feature/Payment/ReportsFromLedgerTest.php
git commit -m "feat(pagos): reports count money received too, so they agree with the screen"
```

---

### Task 7: Verificación de que nada cambió

**Files:** ninguno. Es la corrida que decide si la fase se puede desplegar.

- [ ] **Step 1: Full backend suite**

Run: `cd apps/backend && composer test`
Expected: **exactamente los 9 fallos pre-existentes**, ni uno más. Anotá el total de tests que pasan.

- [ ] **Step 2: Migrations on MySQL from scratch**

Run: `cd apps/backend && php artisan migrate:fresh --seed && php artisan migrate:status | tail -8`
Expected: todas las migraciones corren limpias sobre MySQL, incluida la que ensancha `payment_status` y el backfill sobre datos sembrados.

- [ ] **Step 3: The totals still agree**

```bash
php artisan tinker --execute='
$pagados = App\Infrastructure\Persistence\Models\ServiceLogModel::withoutGlobalScopes()->where("payment_status","paid")->sum("price_charged");
$libro   = App\Infrastructure\Persistence\Models\PaymentModel::withoutGlobalScopes()->sum("amount");
echo "servicios pagados: $pagados | libro: $libro | ".($pagados == $libro ? "COINCIDEN" : "NO COINCIDEN").PHP_EOL;'
```

Expected: COINCIDEN.

- [ ] **Step 4: The screen did not move**

Levantá el stack (`composer dev` y `npm run dev` en `apps/admin-v2`), entrá a
Registro Diario con un tenant que tenga servicios cobrados, y comprobá que los
tiles de INGRESOS DEL DÍA, TARJETA, EFECTIVO y TRANSFERENCIA muestran **los
mismos números que antes de esta fase**. Registrá un servicio cobrando en
efectivo y comprobá que el tile sube por el monto correcto.

Ese es el criterio de la fase: el usuario no puede notar nada.

- [ ] **Step 5: Report**

Contá qué pasó en cada paso, con los números de los pasos 1 y 3.

---

## Notas de ejecución

**Rama.** Esta fase NO va sobre `feat/registro-bitacora-asignados`, que tiene
24 commits de lavador/secador esperando su propio deploy. Rama nueva desde
`main` una vez que aquella esté mergeada, o desde `main` directamente si se
decide desplegarlas por separado.

**El fallo pre-existente que va a confundir.** `ServiceLogTest > create service
log requires required fields` falla desde antes de este trabajo: espera un error
de validación para `payment_method` que el request no exige. No es de esta fase.

**Si el `->change()` de `payment_status` falla en MySQL.** No borres y recrees
la columna: perderías los valores de todas las filas. Reportalo con el error
exacto; la salida es un `DB::statement` con el `ALTER TABLE` explícito por
driver.

**Lo que esta fase deliberadamente NO hace:** no toca la UI, no agrega
`cash_session_id`, no permite cobrar montos parciales desde ninguna pantalla, y
no muestra deuda de clientes. El libro queda listo para las tres, y cada una
llega en su propia fase.
