# Billing Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a service log is marked as paid, automatically emit an electronic invoice via the Facturacion billing microservice and expose full invoice management in the admin panel.

**Architecture:** Turnly's backend dispatches a queued job (`EmitServiceLogInvoiceJob`) after `recordPayment` writes `paid_at`. The job calls `BillingServiceClient` (HTTP facade wrapper) to POST to the external billing service. Invoice status fields are stored on `service_logs`. Admin-v2 grows a `/facturas` page following the same domain → use-case → repository → hook → page layering used everywhere else in the codebase.

**Tech Stack:** Laravel 13 (Eloquent, Queue, Http facade), Pest (tests), Next.js 16 App Router, React Query, Zod, shadcn/ui Badge + Table components, Axios.

## Global Constraints

- Laravel namespace root: `App\` — all PHP files follow PSR-4 under `apps/backend/app/`
- All backend models live in `app/Infrastructure/Persistence/Models/` — never `app/Models/`
- Multi-tenancy: every `ServiceLogModel` query auto-applies `BelongsToTenant` scope; never add a raw `tenant_id` WHERE manually
- Queue connection is `database` in production; tests use `sync` — jobs must use `Illuminate\Bus\Queueable` + `Illuminate\Contracts\Queue\ShouldQueue`
- Admin-v2: TypeScript strict mode; camelCase domain entities; snake_case only in API mappers
- Admin-v2: `'use client'` directive required on any file using hooks or browser APIs
- Admin-v2: all new repository methods added to the domain repository interface first, then implemented in `ApiXxxRepository`
- Billing service base URL comes from env `BILLING_SERVICE_URL`; accessed via `config('services.billing.url')` (never `env()` in app code)
- `payment_method` values in Turnly: `cash`, `card`, `transfer`, `other` — map to SRI `forma_pago`: `cash`→`'01'`, `card`→`'16'`, `transfer`→`'16'`, `credit_card`→`'19'`, `other`→`'20'`
- Consumidor Final fallback: `doc_type='04'`, `identificacion='9999999999999'`, `legal_name='CONSUMIDOR FINAL'`

---

## File Map

**Create (backend):**
- `apps/backend/database/migrations/2026_06_24_800001_add_invoice_fields_to_service_logs.php` — adds 5 invoice columns
- `apps/backend/config/services.php` (modify existing) — add `billing` key
- `apps/backend/app/Infrastructure/Billing/BillingServiceClient.php` — HTTP wrapper for billing microservice
- `apps/backend/app/Infrastructure/Jobs/EmitServiceLogInvoiceJob.php` — queued job, builds payload, calls client, updates service_log
- `apps/backend/tests/Feature/ServiceLog/ServiceLogInvoiceTest.php` — feature tests for invoice endpoint + job

**Modify (backend):**
- `apps/backend/app/Infrastructure/Persistence/Models/ServiceLogModel.php` — add 5 invoice fields to `$fillable` + casts
- `apps/backend/app/Infrastructure/Http/Controllers/ServiceLog/ServiceLogController.php` — hook `recordPayment`, add `invoice()` action, add `indexInvoiced()` action
- `apps/backend/routes/api.php` — add 2 new routes

**Create (admin-v2):**
- `apps/admin-v2/src/domain/entities/invoice.ts` — `Invoice` type, `InvoiceFilters` type
- `apps/admin-v2/src/domain/repositories/invoice.repository.ts` — `InvoiceRepository` interface
- `apps/admin-v2/src/application/use-cases/invoices/get-invoices.use-case.ts`
- `apps/admin-v2/src/application/use-cases/invoices/emit-invoice.use-case.ts`
- `apps/admin-v2/src/application/use-cases/invoices/index.ts`
- `apps/admin-v2/src/infrastructure/api/mappers/invoice.mapper.ts`
- `apps/admin-v2/src/infrastructure/api/repositories/api-invoice.repository.ts`
- `apps/admin-v2/src/presentation/hooks/use-invoices.ts`
- `apps/admin-v2/src/presentation/components/features/service-logs/invoice-status-badge.tsx`
- `apps/admin-v2/src/presentation/app/(tenant)/facturas/page.tsx`

**Modify (admin-v2):**
- `apps/admin-v2/src/domain/entities/service-log.ts` — add `invoiceStatus`, `invoiceClaveAcceso`, `invoiceExternalId` fields
- `apps/admin-v2/src/infrastructure/api/mappers/service-log.mapper.ts` — map new invoice fields
- `apps/admin-v2/src/infrastructure/providers/repository.provider.tsx` — register `invoice` repository
- `apps/admin-v2/src/presentation/components/features/service-logs/log-list.tsx` — show invoice badge + "Facturar" button per row

---

## Task 1: Backend — Migration + Model Update

**Files:**
- Create: `apps/backend/database/migrations/2026_06_24_800001_add_invoice_fields_to_service_logs.php`
- Modify: `apps/backend/app/Infrastructure/Persistence/Models/ServiceLogModel.php`

**Interfaces:**
- Produces: `invoice_external_id`, `invoice_status`, `invoice_clave_acceso`, `invoice_numero_autorizacion`, `invoice_error` columns available on `service_logs`; model fillable/casts updated

- [ ] **Step 1: Write the migration**

Create `apps/backend/database/migrations/2026_06_24_800001_add_invoice_fields_to_service_logs.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_logs', function (Blueprint $table) {
            $table->string('invoice_external_id')->nullable()->after('invoiced_at');
            $table->string('invoice_status', 20)->nullable()->after('invoice_external_id');
            $table->char('invoice_clave_acceso', 49)->nullable()->after('invoice_status');
            $table->string('invoice_numero_autorizacion')->nullable()->after('invoice_clave_acceso');
            $table->text('invoice_error')->nullable()->after('invoice_numero_autorizacion');
        });
    }

    public function down(): void
    {
        Schema::table('service_logs', function (Blueprint $table) {
            $table->dropColumn([
                'invoice_external_id',
                'invoice_status',
                'invoice_clave_acceso',
                'invoice_numero_autorizacion',
                'invoice_error',
            ]);
        });
    }
};
```

- [ ] **Step 2: Run the migration**

```bash
cd apps/backend && php artisan migrate
```

Expected: `Migrating: 2026_06_24_800001_add_invoice_fields_to_service_logs` then `Migrated`.

- [ ] **Step 3: Update ServiceLogModel fillable and casts**

File: `apps/backend/app/Infrastructure/Persistence/Models/ServiceLogModel.php`

Replace the existing `$fillable` array:
```php
protected $fillable = [
    'tenant_id', 'client_resource_id', 'service_id', 'service_variant_id', 'reservation_id',
    'attended_by', 'created_by', 'started_at', 'finished_at',
    'price_charged', 'payment_method', 'payment_bank', 'payment_status', 'paid_at',
    'invoiced', 'invoiced_at',
    'invoice_external_id', 'invoice_status', 'invoice_clave_acceso',
    'invoice_numero_autorizacion', 'invoice_error',
    'status', 'notes', 'log_date',
    'consumption_applied_at',
];
```

Add to `casts()` return array (after `'invoiced_at' => 'datetime'`):
```php
'invoiced' => 'boolean',
'invoiced_at' => 'datetime',
// invoice fields — no special cast needed beyond the defaults
```

The casts block does not need changes for the new string/text columns. Only confirm `'invoiced' => 'boolean'` remains present.

- [ ] **Step 4: Verify with a quick Pest smoke test**

```bash
cd apps/backend && php artisan test --filter=ServiceLogTest
```

Expected: all existing ServiceLog tests still pass (no schema errors).

- [ ] **Step 5: Commit**

```bash
cd apps/backend
git add database/migrations/2026_06_24_800001_add_invoice_fields_to_service_logs.php \
        app/Infrastructure/Persistence/Models/ServiceLogModel.php
git commit -m "feat(billing): add invoice fields migration + model fillable"
```

---

## Task 2: Backend — BillingServiceClient + Config

**Files:**
- Create: `apps/backend/app/Infrastructure/Billing/BillingServiceClient.php`
- Modify: `apps/backend/config/services.php`

**Interfaces:**
- Produces:
  - `BillingServiceClient::emitInvoice(array $data): array` — returns decoded JSON from POST /api/invoices (includes `id`, `estado`, `clave_acceso`, `numero_autorizacion`)
  - `BillingServiceClient::getInvoice(string $id): array` — returns decoded JSON from GET /api/invoices/{id}

- [ ] **Step 1: Add billing URL to config/services.php**

Open `apps/backend/config/services.php` and add a `billing` entry inside the returned array:

```php
'billing' => [
    'url' => env('BILLING_SERVICE_URL', 'http://localhost:8100'),
],
```

- [ ] **Step 2: Add BILLING_SERVICE_URL to .env.template**

Open `apps/backend/.env.template` and append:
```
BILLING_SERVICE_URL=http://localhost:8100
```

- [ ] **Step 3: Create the BillingServiceClient**

Create directory: `apps/backend/app/Infrastructure/Billing/`

Create `apps/backend/app/Infrastructure/Billing/BillingServiceClient.php`:

```php
<?php

declare(strict_types=1);

namespace App\Infrastructure\Billing;

use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class BillingServiceClient
{
    private string $baseUrl;

    public function __construct()
    {
        $this->baseUrl = rtrim((string) config('services.billing.url'), '/');
    }

    /**
     * POST /api/invoices
     *
     * @param  array{
     *   tenant_id: string,
     *   external_ref_id: string,
     *   tipo_identificacion_comprador: string,
     *   razon_social_comprador: string,
     *   identificacion_comprador: string,
     *   direccion_comprador: string|null,
     *   forma_pago: string,
     *   items: array<array{descripcion: string, cantidad: float, precio_unitario: float, descuento: float, codigo_porcentaje_iva: string}>
     * } $data
     * @return array{id: string, estado: string, clave_acceso: string|null, numero_autorizacion: string|null}
     * @throws RuntimeException on HTTP error
     */
    public function emitInvoice(array $data): array
    {
        try {
            $response = Http::timeout(15)
                ->post("{$this->baseUrl}/api/invoices", $data)
                ->throw();

            return $response->json('data', $response->json() ?? []);
        } catch (RequestException $e) {
            throw new RuntimeException(
                'Billing service error: ' . $e->response->body(),
                $e->getCode(),
                $e
            );
        }
    }

    /**
     * GET /api/invoices/{id}
     *
     * @return array{id: string, estado: string, clave_acceso: string|null, numero_autorizacion: string|null}
     * @throws RuntimeException on HTTP error
     */
    public function getInvoice(string $id): array
    {
        try {
            $response = Http::timeout(10)
                ->get("{$this->baseUrl}/api/invoices/{$id}")
                ->throw();

            return $response->json('data', $response->json() ?? []);
        } catch (RequestException $e) {
            throw new RuntimeException(
                'Billing service error: ' . $e->response->body(),
                $e->getCode(),
                $e
            );
        }
    }
}
```

- [ ] **Step 4: Commit**

```bash
cd apps/backend
git add config/services.php \
        .env.template \
        app/Infrastructure/Billing/BillingServiceClient.php
git commit -m "feat(billing): add BillingServiceClient HTTP wrapper"
```

---

## Task 3: Backend — EmitServiceLogInvoiceJob

**Files:**
- Create: `apps/backend/app/Infrastructure/Jobs/EmitServiceLogInvoiceJob.php`

**Interfaces:**
- Consumes: `BillingServiceClient::emitInvoice(array): array` (Task 2), `ServiceLogModel` with columns from Task 1, `UserBillingProfileModel` (`user_billing_profiles` table)
- Produces: `EmitServiceLogInvoiceJob::dispatch(string $serviceLogId)` — dispatchable queued job

- [ ] **Step 1: Write the failing test first**

Create `apps/backend/tests/Feature/ServiceLog/ServiceLogInvoiceTest.php`:

```php
<?php

use App\Infrastructure\Billing\BillingServiceClient;
use App\Infrastructure\Jobs\EmitServiceLogInvoiceJob;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserBillingProfileModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    $this->user   = UserModel::factory()->create();
    $this->service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->clientResource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $this->user->id,
        'type'      => 'sedan',
    ]);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);
});

test('job updates invoice_status to autorizada on success', function () {
    $log = ServiceLogModel::factory()->create([
        'tenant_id'          => $this->tenant->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id'         => $this->service->id,
        'attended_by'        => $this->user->id,
        'created_by'         => $this->user->id,
        'payment_method'     => 'cash',
        'payment_status'     => 'paid',
        'paid_at'            => now(),
        'price_charged'      => 15.00,
    ]);

    Http::fake([
        '*/api/invoices' => Http::response([
            'data' => [
                'id'                   => 'fake-uuid-001',
                'estado'               => 'autorizada',
                'clave_acceso'         => str_repeat('1', 49),
                'numero_autorizacion'  => '2026062412345678',
            ],
        ], 201),
    ]);

    (new EmitServiceLogInvoiceJob($log->id))->handle(new BillingServiceClient());

    $log->refresh();
    expect($log->invoice_external_id)->toBe('fake-uuid-001')
        ->and($log->invoice_status)->toBe('autorizada')
        ->and($log->invoice_clave_acceso)->toBe(str_repeat('1', 49))
        ->and($log->invoiced)->toBeTrue()
        ->and($log->invoiced_at)->not->toBeNull();
});

test('job sets invoice_status to rechazada on billing error', function () {
    $log = ServiceLogModel::factory()->create([
        'tenant_id'          => $this->tenant->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id'         => $this->service->id,
        'attended_by'        => $this->user->id,
        'created_by'         => $this->user->id,
        'payment_method'     => 'cash',
        'payment_status'     => 'paid',
        'paid_at'            => now(),
        'price_charged'      => 15.00,
    ]);

    Http::fake([
        '*/api/invoices' => Http::response(['error' => 'SRI timeout'], 500),
    ]);

    (new EmitServiceLogInvoiceJob($log->id))->handle(new BillingServiceClient());

    $log->refresh();
    expect($log->invoice_status)->toBe('rechazada')
        ->and($log->invoice_error)->not->toBeNull()
        ->and($log->invoiced)->toBeFalse();
});

test('job uses consumidor final fallback when client has no billing profile', function () {
    $log = ServiceLogModel::factory()->create([
        'tenant_id'          => $this->tenant->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id'         => $this->service->id,
        'attended_by'        => $this->user->id,
        'created_by'         => $this->user->id,
        'payment_method'     => 'cash',
        'payment_status'     => 'paid',
        'paid_at'            => now(),
        'price_charged'      => 12.00,
    ]);

    Http::fake([
        '*/api/invoices' => Http::response([
            'data' => [
                'id'      => 'fake-uuid-002',
                'estado'  => 'enviada',
                'clave_acceso' => null,
                'numero_autorizacion' => null,
            ],
        ], 201),
    ]);

    (new EmitServiceLogInvoiceJob($log->id))->handle(new BillingServiceClient());

    Http::assertSent(function ($request) {
        $body = $request->data();
        return $body['identificacion_comprador'] === '9999999999999'
            && $body['razon_social_comprador']   === 'CONSUMIDOR FINAL'
            && $body['tipo_identificacion_comprador'] === '07';
    });
});

test('job uses client billing profile when available', function () {
    UserBillingProfileModel::create([
        'user_id'    => $this->user->id,
        'doc_type'   => 'cedula',
        'doc_number' => '1234567890',
        'legal_name' => 'Juan Pérez',
        'is_default' => true,
    ]);

    $log = ServiceLogModel::factory()->create([
        'tenant_id'          => $this->tenant->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id'         => $this->service->id,
        'attended_by'        => $this->user->id,
        'created_by'         => $this->user->id,
        'payment_method'     => 'card',
        'payment_status'     => 'paid',
        'paid_at'            => now(),
        'price_charged'      => 20.00,
    ]);

    Http::fake([
        '*/api/invoices' => Http::response([
            'data' => ['id' => 'fake-uuid-003', 'estado' => 'autorizada', 'clave_acceso' => str_repeat('2', 49), 'numero_autorizacion' => 'abc'],
        ], 201),
    ]);

    (new EmitServiceLogInvoiceJob($log->id))->handle(new BillingServiceClient());

    Http::assertSent(function ($request) {
        $body = $request->data();
        return $body['identificacion_comprador'] === '1234567890'
            && $body['razon_social_comprador']   === 'Juan Pérez'
            && $body['tipo_identificacion_comprador'] === '05'  // cedula
            && $body['forma_pago'] === '16';                    // card
    });
});
```

- [ ] **Step 2: Run tests to verify they fail with class-not-found**

```bash
cd apps/backend && php artisan test --filter=ServiceLogInvoiceTest
```

Expected: FAIL — `Class "App\Infrastructure\Jobs\EmitServiceLogInvoiceJob" not found`

- [ ] **Step 3: Create the Job**

Create directory: `apps/backend/app/Infrastructure/Jobs/`

Create `apps/backend/app/Infrastructure/Jobs/EmitServiceLogInvoiceJob.php`:

```php
<?php

declare(strict_types=1);

namespace App\Infrastructure\Jobs;

use App\Infrastructure\Billing\BillingServiceClient;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceLogModel;
use App\Infrastructure\Persistence\Models\UserBillingProfileModel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

class EmitServiceLogInvoiceJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(public readonly string $serviceLogId) {}

    public function handle(BillingServiceClient $client): void
    {
        $log = ServiceLogModel::with(['items', 'service', 'clientResource.client'])->findOrFail($this->serviceLogId);

        // Resolve buyer identity
        $billingProfile = $this->resolveBillingProfile($log->clientResource);

        // Map payment_method to SRI forma_pago code
        $formaPago = match ($log->payment_method) {
            'cash'        => '01',
            'card'        => '16',
            'transfer'    => '16',
            'credit_card' => '19',
            default       => '20',
        };

        // Build line items
        $items = $this->buildItems($log);

        $payload = [
            'tenant_id'                       => $log->tenant_id,
            'external_ref_id'                 => $log->id,
            'tipo_identificacion_comprador'   => $billingProfile['tipo'],
            'razon_social_comprador'          => $billingProfile['legal_name'],
            'identificacion_comprador'        => $billingProfile['doc_number'],
            'direccion_comprador'             => $billingProfile['address'] ?? null,
            'forma_pago'                      => $formaPago,
            'items'                           => $items,
        ];

        try {
            $result = $client->emitInvoice($payload);

            $log->update([
                'invoice_external_id'         => $result['id'] ?? null,
                'invoice_status'              => $result['estado'] ?? 'enviada',
                'invoice_clave_acceso'        => $result['clave_acceso'] ?? null,
                'invoice_numero_autorizacion' => $result['numero_autorizacion'] ?? null,
                'invoice_error'               => null,
                'invoiced'                    => true,
                'invoiced_at'                 => now(),
            ]);
        } catch (Throwable $e) {
            $log->update([
                'invoice_status' => 'rechazada',
                'invoice_error'  => $e->getMessage(),
            ]);
        }
    }

    // ---------------------------------------------------------------
    // Private helpers
    // ---------------------------------------------------------------

    private function resolveBillingProfile(?ClientResourceModel $clientResource): array
    {
        if ($clientResource && $clientResource->client) {
            $profile = UserBillingProfileModel::where('user_id', $clientResource->client->id)
                ->where('is_default', true)
                ->first();

            if ($profile) {
                return [
                    'tipo'       => $this->tipoIdentificacion($profile->doc_type),
                    'doc_number' => $profile->doc_number,
                    'legal_name' => $profile->legal_name,
                    'address'    => $profile->address,
                ];
            }
        }

        // Consumidor Final fallback
        return [
            'tipo'       => '07',
            'doc_number' => '9999999999999',
            'legal_name' => 'CONSUMIDOR FINAL',
            'address'    => null,
        ];
    }

    private function tipoIdentificacion(string $docType): string
    {
        return match ($docType) {
            'ruc'      => '04',
            'cedula'   => '05',
            'passport' => '06',
            default    => '07', // final_consumer / unknown
        };
    }

    private function buildItems(ServiceLogModel $log): array
    {
        if ($log->items && $log->items->isNotEmpty()) {
            return $log->items->map(fn ($item) => [
                'descripcion'          => (string) $item->label,
                'cantidad'             => (float) $item->qty,
                'precio_unitario'      => (float) $item->unit_price,
                'descuento'            => 0.0,
                'codigo_porcentaje_iva' => '4', // IVA 15%
            ])->values()->all();
        }

        // Legacy single-service log — use price_charged as one line
        $description = $log->service?->name ?? 'Servicio';

        return [[
            'descripcion'          => $description,
            'cantidad'             => 1.0,
            'precio_unitario'      => (float) $log->price_charged,
            'descuento'            => 0.0,
            'codigo_porcentaje_iva' => '4',
        ]];
    }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd apps/backend && php artisan test --filter=ServiceLogInvoiceTest
```

Expected: 4 tests pass. If `Http::fake` does not intercept, ensure `Http::fake` is called before the job runs — the test already does this correctly.

- [ ] **Step 5: Commit**

```bash
cd apps/backend
git add app/Infrastructure/Jobs/EmitServiceLogInvoiceJob.php \
        tests/Feature/ServiceLog/ServiceLogInvoiceTest.php
git commit -m "feat(billing): add EmitServiceLogInvoiceJob with consumidor final fallback"
```

---

## Task 4: Backend — Wire recordPayment + add invoice/indexInvoiced actions

**Files:**
- Modify: `apps/backend/app/Infrastructure/Http/Controllers/ServiceLog/ServiceLogController.php`
- Modify: `apps/backend/routes/api.php`

**Interfaces:**
- Consumes: `EmitServiceLogInvoiceJob::dispatch(string)` (Task 3)
- Produces:
  - `POST /api/v1/service-logs/{id}/invoice` → 202 JSON `{data: {message: string}}`
  - `GET /api/v1/invoices` → paginated ServiceLogResource collection (only rows where `invoice_status IS NOT NULL`)

- [ ] **Step 1: Write failing tests for new endpoints**

Append to `apps/backend/tests/Feature/ServiceLog/ServiceLogInvoiceTest.php`:

```php
test('POST /service-logs/{id}/invoice dispatches job and returns 202', function () {
    Queue::fake();

    $log = ServiceLogModel::factory()->create([
        'tenant_id'          => $this->tenant->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id'         => $this->service->id,
        'attended_by'        => $this->user->id,
        'created_by'         => $this->user->id,
        'payment_status'     => 'paid',
        'paid_at'            => now(),
    ]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson("/api/v1/service-logs/{$log->id}/invoice");

    $response->assertStatus(202);
    Queue::assertPushed(\App\Infrastructure\Jobs\EmitServiceLogInvoiceJob::class, function ($job) use ($log) {
        return $job->serviceLogId === $log->id;
    });
});

test('POST /service-logs/{id}/invoice returns 422 if already autorizada', function () {
    $log = ServiceLogModel::factory()->create([
        'tenant_id'          => $this->tenant->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id'         => $this->service->id,
        'attended_by'        => $this->user->id,
        'created_by'         => $this->user->id,
        'payment_status'     => 'paid',
        'paid_at'            => now(),
        'invoice_status'     => 'autorizada',
    ]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->postJson("/api/v1/service-logs/{$log->id}/invoice");

    $response->assertStatus(422)
        ->assertJsonPath('error.code', 'ALREADY_INVOICED');
});

test('GET /invoices returns only invoiced service logs', function () {
    ServiceLogModel::factory()->count(2)->create([
        'tenant_id'          => $this->tenant->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id'         => $this->service->id,
        'attended_by'        => $this->user->id,
        'created_by'         => $this->user->id,
        'invoice_status'     => 'autorizada',
    ]);
    // Create one without invoice status — should NOT appear
    ServiceLogModel::factory()->create([
        'tenant_id'          => $this->tenant->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id'         => $this->service->id,
        'attended_by'        => $this->user->id,
        'created_by'         => $this->user->id,
        'invoice_status'     => null,
    ]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->getJson('/api/v1/invoices');

    $response->assertOk()
        ->assertJsonCount(2, 'data');
});
```

- [ ] **Step 2: Run tests to verify they fail (route not found)**

```bash
cd apps/backend && php artisan test --filter=ServiceLogInvoiceTest
```

Expected: 3 new tests fail with 404 or "route not found" errors.

- [ ] **Step 3: Add invoice() and indexInvoiced() methods to ServiceLogController**

Add these imports at the top of `ServiceLogController.php` (after existing `use` statements):
```php
use App\Infrastructure\Jobs\EmitServiceLogInvoiceJob;
```

Inside the `ServiceLogController` class, append two new methods after `recordPayment`:

```php
public function invoice(string $id): JsonResponse
{
    $log = ServiceLogModel::findOrFail($id);

    if ($log->invoice_status === 'autorizada') {
        return response()->json([
            'error' => [
                'code'    => 'ALREADY_INVOICED',
                'message' => 'Esta factura ya fue autorizada por el SRI.',
            ],
        ], 422);
    }

    EmitServiceLogInvoiceJob::dispatch($id);

    return response()->json([
        'data' => ['message' => 'Facturación iniciada.'],
    ], 202);
}

public function indexInvoiced(Request $request): \Illuminate\Http\Resources\Json\AnonymousResourceCollection
{
    $query = ServiceLogModel::with(['clientResource', 'service', 'attendant'])
        ->whereNotNull('invoice_status');

    if ($request->has('status')) {
        $query->where('invoice_status', $request->status);
    }

    if ($request->has('date_from')) {
        $query->whereDate('log_date', '>=', $request->date_from);
    }

    if ($request->has('date_to')) {
        $query->whereDate('log_date', '<=', $request->date_to);
    }

    $logs = $query->orderBy('invoiced_at', 'desc')
        ->paginate($request->get('per_page', 50));

    return ServiceLogResource::collection($logs);
}
```

- [ ] **Step 4: Add routes to api.php**

In `apps/backend/routes/api.php`, after the existing service-log routes (after line with `recordPayment`):

```php
Route::post('service-logs/{id}/invoice', [ServiceLogController::class, 'invoice']);
Route::get('invoices', [ServiceLogController::class, 'indexInvoiced']);
```

Both lines go inside the same tenant-scoped middleware group as the other service-log routes.

- [ ] **Step 5: Run all ServiceLog tests**

```bash
cd apps/backend && php artisan test --filter=ServiceLogInvoiceTest
```

Expected: all 7 tests in `ServiceLogInvoiceTest` pass.

- [ ] **Step 6: Run full test suite**

```bash
cd apps/backend && composer test
```

Expected: all existing tests still pass.

- [ ] **Step 7: Modify recordPayment to dispatch the job**

In `ServiceLogController::recordPayment`, replace the final `return` statement so the job is dispatched after the update. The final block of `recordPayment` becomes:

```php
        $log->update([
            'payment_method' => $data['method'],
            'payment_bank'   => $data['method'] === 'transfer' ? ($data['bank'] ?? null) : null,
            'payment_status' => 'paid',
            'paid_at'        => now(),
            'notes'          => trim(($log->notes ?? '') . ($data['reference'] ?? '' ? "\nRef: {$data['reference']}" : '')) ?: null,
        ]);

        EmitServiceLogInvoiceJob::dispatch($log->id);

        return (new ServiceLogResource(
            $log->load(['clientResource', 'service', 'attendant'])
        ))->response()->setStatusCode(200);
```

- [ ] **Step 8: Commit**

```bash
cd apps/backend
git add app/Infrastructure/Http/Controllers/ServiceLog/ServiceLogController.php \
        routes/api.php \
        tests/Feature/ServiceLog/ServiceLogInvoiceTest.php
git commit -m "feat(billing): wire recordPayment → EmitServiceLogInvoiceJob, add invoice + indexInvoiced routes"
```

---

## Task 5: Admin-v2 — Domain Layer (Invoice entity + repository interface)

**Files:**
- Create: `apps/admin-v2/src/domain/entities/invoice.ts`
- Create: `apps/admin-v2/src/domain/repositories/invoice.repository.ts`
- Modify: `apps/admin-v2/src/domain/entities/service-log.ts`
- Modify: `apps/admin-v2/src/infrastructure/api/mappers/service-log.mapper.ts`

**Interfaces:**
- Produces:
  - `Invoice` type with all invoice fields
  - `InvoiceFilters` type
  - `InvoiceRepository` interface with `getAll(filters): Promise<PaginatedResult<Invoice>>`
  - `emitInvoice(serviceLogId: string): Promise<void>` method on interface
  - `ServiceLog` type extended with `invoiceStatus`, `invoiceClaveAcceso`, `invoiceExternalId`, `invoiceNumeroAutorizacion`

- [ ] **Step 1: Extend service-log.ts domain entity**

In `apps/admin-v2/src/domain/entities/service-log.ts`, add four fields to the `ServiceLog` interface after `invoicedAt`:

```typescript
  invoiceStatus: 'pendiente' | 'enviada' | 'autorizada' | 'rechazada' | null;
  invoiceExternalId: string | null;
  invoiceClaveAcceso: string | null;
  invoiceNumeroAutorizacion: string | null;
  invoiceError: string | null;
```

- [ ] **Step 2: Update service-log mapper**

In `apps/admin-v2/src/infrastructure/api/mappers/service-log.mapper.ts`, inside `mapServiceLog`, add after `invoicedAt`:

```typescript
    invoiceStatus: (raw.invoice_status as ServiceLog['invoiceStatus']) ?? null,
    invoiceExternalId: (raw.invoice_external_id as string | null) ?? null,
    invoiceClaveAcceso: (raw.invoice_clave_acceso as string | null) ?? null,
    invoiceNumeroAutorizacion: (raw.invoice_numero_autorizacion as string | null) ?? null,
    invoiceError: (raw.invoice_error as string | null) ?? null,
```

- [ ] **Step 3: Create invoice domain entity**

Create `apps/admin-v2/src/domain/entities/invoice.ts`:

```typescript
export type InvoiceStatus = 'pendiente' | 'enviada' | 'autorizada' | 'rechazada';

export interface Invoice {
  id: string;
  serviceLogId: string;
  externalId: string;
  claveAcceso: string | null;
  numeroAutorizacion: string | null;
  invoiceStatus: InvoiceStatus;
  invoiceError: string | null;
  logDate: string;
  invoicedAt: Date | null;
  priceCharged: number;
  paymentMethod: string | null;
  clientName: string | null;
  clientPlate: string | null;
  serviceName: string | null;
}

export interface InvoiceFilters {
  dateFrom?: string;
  dateTo?: string;
  status?: InvoiceStatus;
  page?: number;
}
```

- [ ] **Step 4: Create invoice repository interface**

Create `apps/admin-v2/src/domain/repositories/invoice.repository.ts`:

```typescript
import type { Invoice, InvoiceFilters } from '../entities/invoice';
import type { PaginatedResult } from '../../shared/types/api';

export interface InvoiceRepository {
  getAll(filters: InvoiceFilters): Promise<PaginatedResult<Invoice>>;
  emit(serviceLogId: string): Promise<void>;
}
```

- [ ] **Step 5: Run TypeScript check**

```bash
cd apps/admin-v2 && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors related to the files just created/modified.

- [ ] **Step 6: Commit**

```bash
cd apps/admin-v2
git add src/domain/entities/invoice.ts \
        src/domain/entities/service-log.ts \
        src/domain/repositories/invoice.repository.ts \
        src/infrastructure/api/mappers/service-log.mapper.ts
git commit -m "feat(billing): add Invoice domain entity + repository interface, extend ServiceLog"
```

---

## Task 6: Admin-v2 — Infrastructure + Application Layer

**Files:**
- Create: `apps/admin-v2/src/application/use-cases/invoices/get-invoices.use-case.ts`
- Create: `apps/admin-v2/src/application/use-cases/invoices/emit-invoice.use-case.ts`
- Create: `apps/admin-v2/src/application/use-cases/invoices/index.ts`
- Create: `apps/admin-v2/src/infrastructure/api/mappers/invoice.mapper.ts`
- Create: `apps/admin-v2/src/infrastructure/api/repositories/api-invoice.repository.ts`
- Modify: `apps/admin-v2/src/infrastructure/providers/repository.provider.tsx`

**Interfaces:**
- Consumes: `InvoiceRepository` (Task 5), `Invoice`/`InvoiceFilters` types (Task 5)
- Produces:
  - `GetInvoicesUseCase` class with `execute(filters: InvoiceFilters): Promise<PaginatedResult<Invoice>>`
  - `EmitInvoiceUseCase` class with `execute(serviceLogId: string): Promise<void>`
  - `ApiInvoiceRepository` registered as `invoice` key in `RepositoryProvider`

- [ ] **Step 1: Create use-cases**

Create `apps/admin-v2/src/application/use-cases/invoices/get-invoices.use-case.ts`:

```typescript
import type { InvoiceRepository } from '@/domain/repositories/invoice.repository';
import type { InvoiceFilters } from '@/domain/entities/invoice';

export class GetInvoicesUseCase {
  constructor(private repo: InvoiceRepository) {}

  execute(filters: InvoiceFilters) {
    return this.repo.getAll(filters);
  }
}
```

Create `apps/admin-v2/src/application/use-cases/invoices/emit-invoice.use-case.ts`:

```typescript
import type { InvoiceRepository } from '@/domain/repositories/invoice.repository';

export class EmitInvoiceUseCase {
  constructor(private repo: InvoiceRepository) {}

  execute(serviceLogId: string) {
    return this.repo.emit(serviceLogId);
  }
}
```

Create `apps/admin-v2/src/application/use-cases/invoices/index.ts`:

```typescript
export { GetInvoicesUseCase } from './get-invoices.use-case';
export { EmitInvoiceUseCase } from './emit-invoice.use-case';
```

- [ ] **Step 2: Create invoice mapper**

Create `apps/admin-v2/src/infrastructure/api/mappers/invoice.mapper.ts`:

```typescript
import type { Invoice } from '@/domain/entities/invoice';

export function mapInvoice(raw: Record<string, unknown>): Invoice {
  const clientResource = raw.client_resource as Record<string, unknown> | undefined;
  const service = raw.service as Record<string, unknown> | undefined;

  return {
    id: raw.id as string,
    serviceLogId: raw.id as string,
    externalId: (raw.invoice_external_id as string) ?? '',
    claveAcceso: (raw.invoice_clave_acceso as string | null) ?? null,
    numeroAutorizacion: (raw.invoice_numero_autorizacion as string | null) ?? null,
    invoiceStatus: raw.invoice_status as Invoice['invoiceStatus'],
    invoiceError: (raw.invoice_error as string | null) ?? null,
    logDate: raw.log_date as string,
    invoicedAt: raw.invoiced_at ? new Date(raw.invoiced_at as string) : null,
    priceCharged:
      typeof raw.price_charged === 'string'
        ? parseFloat(raw.price_charged)
        : (raw.price_charged as number),
    paymentMethod: (raw.payment_method as string | null) ?? null,
    clientName: clientResource?.client
      ? ((clientResource.client as Record<string, unknown>).name as string)
      : null,
    clientPlate: (clientResource?.plate as string | null) ?? null,
    serviceName: service ? (service.name as string) : null,
  };
}
```

- [ ] **Step 3: Create API repository**

Create `apps/admin-v2/src/infrastructure/api/repositories/api-invoice.repository.ts`:

```typescript
import type { InvoiceRepository } from '@/domain/repositories/invoice.repository';
import type { Invoice, InvoiceFilters } from '@/domain/entities/invoice';
import type { PaginatedResult } from '@/shared/types/api';
import api from '../client';
import { mapInvoice } from '../mappers/invoice.mapper';
import { mapPaginatedResponse } from '../mappers/pagination';

export class ApiInvoiceRepository implements InvoiceRepository {
  async getAll(filters: InvoiceFilters): Promise<PaginatedResult<Invoice>> {
    const params: Record<string, unknown> = {};
    if (filters.dateFrom) params.date_from = filters.dateFrom;
    if (filters.dateTo) params.date_to = filters.dateTo;
    if (filters.status) params.status = filters.status;
    if (filters.page) params.page = filters.page;

    const { data: res } = await api.get('/invoices', { params });
    return mapPaginatedResponse(res, mapInvoice);
  }

  async emit(serviceLogId: string): Promise<void> {
    await api.post(`/service-logs/${serviceLogId}/invoice`);
  }
}
```

- [ ] **Step 4: Register repository in RepositoryProvider**

In `apps/admin-v2/src/infrastructure/providers/repository.provider.tsx`:

Add import:
```typescript
import type { InvoiceRepository } from '@/domain/repositories/invoice.repository';
import { ApiInvoiceRepository } from '../api/repositories/api-invoice.repository';
```

Add `invoice: InvoiceRepository;` to the `Repositories` interface.

Add `invoice: new ApiInvoiceRepository(),` to the `useMemo` object inside `RepositoryProvider`.

- [ ] **Step 5: TypeScript check**

```bash
cd apps/admin-v2 && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd apps/admin-v2
git add src/application/use-cases/invoices/ \
        src/infrastructure/api/mappers/invoice.mapper.ts \
        src/infrastructure/api/repositories/api-invoice.repository.ts \
        src/infrastructure/providers/repository.provider.tsx
git commit -m "feat(billing): add invoice use-cases, mapper, API repository, register in provider"
```

---

## Task 7: Admin-v2 — Invoice status badge + log-list hook + Facturar button

**Files:**
- Create: `apps/admin-v2/src/presentation/components/features/service-logs/invoice-status-badge.tsx`
- Create: `apps/admin-v2/src/presentation/hooks/use-invoices.ts`
- Modify: `apps/admin-v2/src/presentation/components/features/service-logs/log-list.tsx`

**Interfaces:**
- Consumes: `InvoiceRepository` via `useRepository('invoice')` (Task 6)
- Produces: `<InvoiceStatusBadge status={...} />`, `useEmitInvoice()` mutation hook, invoice status badge visible in log list rows

- [ ] **Step 1: Create InvoiceStatusBadge component**

Create `apps/admin-v2/src/presentation/components/features/service-logs/invoice-status-badge.tsx`:

```typescript
'use client';

import { Badge } from '@/presentation/components/ui/badge';
import { cn } from '@/shared/utils/cn';
import type { ServiceLog } from '@/domain/entities/service-log';

type InvoiceStatus = NonNullable<ServiceLog['invoiceStatus']>;

const CONFIG: Record<InvoiceStatus, { label: string; className: string }> = {
  pendiente:  { label: 'Pendiente',  className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  enviada:    { label: 'Enviada',    className: 'bg-blue-100 text-blue-800 border-blue-200' },
  autorizada: { label: 'Autorizada', className: 'bg-green-100 text-green-800 border-green-200' },
  rechazada:  { label: 'Rechazada',  className: 'bg-red-100 text-red-800 border-red-200' },
};

interface InvoiceStatusBadgeProps {
  status: InvoiceStatus | null;
  className?: string;
}

export function InvoiceStatusBadge({ status, className }: InvoiceStatusBadgeProps) {
  if (!status) return null;
  const { label, className: statusClass } = CONFIG[status];
  return (
    <Badge variant="outline" className={cn(statusClass, className)}>
      {label}
    </Badge>
  );
}
```

- [ ] **Step 2: Create use-invoices hook**

Create `apps/admin-v2/src/presentation/hooks/use-invoices.ts`:

```typescript
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/infrastructure/providers/repository.provider';
import { GetInvoicesUseCase, EmitInvoiceUseCase } from '@/application/use-cases/invoices';
import type { InvoiceFilters } from '@/domain/entities/invoice';

export function useInvoices(filters: InvoiceFilters) {
  const repo = useRepository('invoice');
  return useQuery({
    queryKey: ['invoices', filters],
    queryFn: () => new GetInvoicesUseCase(repo).execute(filters),
  });
}

export function useEmitInvoice() {
  const repo = useRepository('invoice');
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (serviceLogId: string) =>
      new EmitInvoiceUseCase(repo).execute(serviceLogId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-logs'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}
```

- [ ] **Step 3: Add invoice badge + Facturar button to log-list.tsx**

In `apps/admin-v2/src/presentation/components/features/service-logs/log-list.tsx`:

Add imports at the top (after existing imports):
```typescript
import { InvoiceStatusBadge } from '@/presentation/components/features/service-logs/invoice-status-badge';
import { useEmitInvoice } from '@/presentation/hooks/use-invoices';
import { FileText } from 'lucide-react';
```

Add hook usage inside `LogList` function body (after existing mutation hooks):
```typescript
const emitInvoiceMutation = useEmitInvoice();
```

Inside the JSX where each log row is rendered, find the section that renders the payment status badge or the row actions area and add the invoice badge and button. The exact insertion depends on the row JSX, but the pattern is:

```typescript
{/* Invoice status badge — shown only when invoice was attempted */}
<InvoiceStatusBadge status={log.invoiceStatus} className="ml-1" />
```

And in the `DropdownMenuContent` for each row, add a new menu item after the existing items:
```typescript
{log.paymentStatus === 'paid' && log.invoiceStatus !== 'autorizada' && (
  <DropdownMenuItem
    onClick={() =>
      emitInvoiceMutation.mutate(log.id, {
        onSuccess: () => toast.success('Facturación iniciada'),
        onError: () => toast.error('Error al iniciar facturación'),
      })
    }
  >
    <FileText className="mr-2 h-4 w-4" />
    {log.invoiceStatus === 'rechazada' ? 'Reintentar factura' : 'Facturar'}
  </DropdownMenuItem>
)}
```

- [ ] **Step 4: TypeScript check**

```bash
cd apps/admin-v2 && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd apps/admin-v2
git add src/presentation/components/features/service-logs/invoice-status-badge.tsx \
        src/presentation/hooks/use-invoices.ts \
        src/presentation/components/features/service-logs/log-list.tsx
git commit -m "feat(billing): add InvoiceStatusBadge, useEmitInvoice hook, Facturar button in log list"
```

---

## Task 8: Admin-v2 — /facturas page

**Files:**
- Create: `apps/admin-v2/src/presentation/app/(tenant)/facturas/page.tsx`

**Interfaces:**
- Consumes: `useInvoices(filters)` (Task 7), `InvoiceStatusBadge` (Task 7), `Invoice` type (Task 5)
- Produces: `/facturas` page with date-range filters, paginated table, status badge per row, download XML button

- [ ] **Step 1: Create the facturas page**

Create `apps/admin-v2/src/presentation/app/(tenant)/facturas/page.tsx`:

```typescript
'use client';

import { Suspense, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, Download } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Calendar } from '@/presentation/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/presentation/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { InvoiceStatusBadge } from '@/presentation/components/features/service-logs/invoice-status-badge';
import { useInvoices } from '@/presentation/hooks/use-invoices';
import type { InvoiceFilters, InvoiceStatus } from '@/domain/entities/invoice';

const BILLING_SERVICE_URL =
  process.env.NEXT_PUBLIC_BILLING_SERVICE_URL ?? 'http://localhost:8100';

function FacturasContent() {
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [status, setStatus] = useState<InvoiceStatus | undefined>(undefined);
  const [page, setPage] = useState(1);

  const filters: InvoiceFilters = {
    dateFrom: dateFrom ? format(dateFrom, 'yyyy-MM-dd') : undefined,
    dateTo: dateTo ? format(dateTo, 'yyyy-MM-dd') : undefined,
    status,
    page,
  };

  const { data, isLoading } = useInvoices(filters);
  const invoices = data?.data ?? [];
  const meta = data?.meta;

  const fmt = (v: number) =>
    new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(v);

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold flex-1">Facturas</h1>

        {/* Date from */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateFrom ? format(dateFrom, 'dd MMM', { locale: es }) : 'Desde'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateFrom}
              onSelect={setDateFrom}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {/* Date to */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateTo ? format(dateTo, 'dd MMM', { locale: es }) : 'Hasta'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateTo}
              onSelect={setDateTo}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {/* Status filter */}
        <Select
          value={status ?? 'all'}
          onValueChange={(v) =>
            setStatus(v === 'all' ? undefined : (v as InvoiceStatus))
          }
        >
          <SelectTrigger className="w-40 h-9">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="enviada">Enviada</SelectItem>
            <SelectItem value="autorizada">Autorizada</SelectItem>
            <SelectItem value="rechazada">Rechazada</SelectItem>
          </SelectContent>
        </Select>

        {/* Clear filters */}
        {(dateFrom || dateTo || status) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDateFrom(undefined);
              setDateTo(undefined);
              setStatus(undefined);
              setPage(1);
            }}
          >
            Limpiar
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No hay facturas con los filtros seleccionados.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left font-medium">Fecha</th>
                <th className="px-3 py-2 text-left font-medium">Cliente</th>
                <th className="px-3 py-2 text-left font-medium">Servicio</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
                <th className="px-3 py-2 text-left font-medium">Estado</th>
                <th className="px-3 py-2 text-left font-medium">Clave acceso</th>
                <th className="px-3 py-2 text-center font-medium">XML</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 whitespace-nowrap">{inv.logDate}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{inv.clientName ?? '—'}</div>
                    {inv.clientPlate && (
                      <div className="text-xs text-muted-foreground">{inv.clientPlate}</div>
                    )}
                  </td>
                  <td className="px-3 py-2">{inv.serviceName ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(inv.priceCharged)}</td>
                  <td className="px-3 py-2">
                    <InvoiceStatusBadge status={inv.invoiceStatus} />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground truncate max-w-[160px]">
                    {inv.claveAcceso ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {inv.invoiceStatus === 'autorizada' && inv.externalId ? (
                      <a
                        href={`${BILLING_SERVICE_URL}/api/invoices/${inv.externalId}/xml`}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                      >
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Download className="h-4 w-4" />
                        </Button>
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {meta && meta.lastPage > 1 && (
        <div className="flex justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </Button>
          <span className="text-sm self-center text-muted-foreground">
            {page} / {meta.lastPage}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= meta.lastPage}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
}

export default function FacturasPage() {
  return (
    <Suspense>
      <FacturasContent />
    </Suspense>
  );
}
```

- [ ] **Step 2: Add NEXT_PUBLIC_BILLING_SERVICE_URL to admin env**

Check if `apps/admin-v2/.env.local` or `apps/admin-v2/.env.development` exists. Add to whichever exists (or `.env.local`):

```
NEXT_PUBLIC_BILLING_SERVICE_URL=http://localhost:8100
```

- [ ] **Step 3: Check the PaginatedResult meta shape**

The pagination buttons use `meta.lastPage`. Verify the `PaginatedResult` type at `apps/admin-v2/src/shared/types/api.ts` includes a `meta` property with `lastPage`. If it uses `last_page` instead, update the `page >= meta.lastPage` references in the page to match.

Run:
```bash
grep -n "lastPage\|last_page" /Users/korbold/Developer/Freelancer/Turnly/apps/admin-v2/src/shared/types/api.ts
grep -n "lastPage\|last_page" /Users/korbold/Developer/Freelancer/Turnly/apps/admin-v2/src/infrastructure/api/mappers/pagination.ts
```

Update `facturas/page.tsx` to use `meta.last_page` if that is the actual property name.

- [ ] **Step 4: TypeScript check**

```bash
cd apps/admin-v2 && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 5: Build check**

```bash
cd apps/admin-v2 && npm run build 2>&1 | tail -20
```

Expected: build succeeds with no type errors.

- [ ] **Step 6: Commit**

```bash
cd apps/admin-v2
git add src/presentation/app/\(tenant\)/facturas/page.tsx
git commit -m "feat(billing): add /facturas page with date/status filters, table, XML download"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Task |
|---|---|
| Auto-emit on payment | Task 4 (dispatch in `recordPayment`) |
| Manual retry button | Task 7 (Facturar/Reintentar in DropdownMenu) |
| Consumidor Final fallback | Task 3 (job `resolveBillingProfile`) |
| Migration 5 columns | Task 1 |
| BillingServiceClient | Task 2 |
| EmitServiceLogInvoiceJob | Task 3 |
| POST /service-logs/{id}/invoice | Task 4 |
| GET /invoices | Task 4 |
| Invoice status badge in service log | Task 7 |
| /facturas page (list, filters) | Task 8 |
| /facturas download XML | Task 8 |
| payment_method → forma_pago mapping | Task 3 |

**Placeholder scan:** No TBD, TODO, or "similar to" references found. All code steps include full implementations.

**Type consistency check:**
- `invoice_external_id` (DB) → `invoiceExternalId` (domain) — consistent in mapper (Task 5) and used in `facturas/page.tsx` as `inv.externalId` via `Invoice.externalId` mapped from `invoice_external_id`
- `EmitServiceLogInvoiceJob` constructor takes `string $serviceLogId` — dispatched as `EmitServiceLogInvoiceJob::dispatch($log->id)` in Task 4
- `useEmitInvoice()` calls `repo.emit(serviceLogId)` → `ApiInvoiceRepository.emit(serviceLogId)` → `POST /service-logs/{id}/invoice` — consistent
- `InvoiceFilters.dateFrom`/`dateTo` → mapped to `date_from`/`date_to` params in `ApiInvoiceRepository.getAll` — consistent with `indexInvoiced` which reads `$request->date_from` / `$request->date_to`
