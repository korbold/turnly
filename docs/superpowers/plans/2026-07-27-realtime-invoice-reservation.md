# Realtime: Invoice Status + Reservation Gaps — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Push invoice status changes and new/updated reservations to the admin web and Flutter app in real time (websocket + FCM push), closing the gaps where users must change screens to see the new state.

**Architecture:** Reuse the existing Laravel Reverb websocket stack (already running dev+prod on `:8080` → `wss://api.goturnly.com/app`), the admin Laravel Echo client, the Flutter `pusher_channels_flutter` client, and the hand-rolled FCM channel. Add one new broadcast event (`InvoiceStatusUpdated`), two FCM notifications, dispatch calls in the invoice jobs and the create-reservation use case, an extra Echo listener in the admin, and a broadcast `Stream` in the Flutter Pusher service so the reservation detail screen can subscribe.

**Tech Stack:** Laravel 13 / Pest (backend), Next.js 16 + React Query + laravel-echo/pusher-js (admin), Flutter + BLoC + pusher_channels_flutter (mobile), Firebase Cloud Messaging v1.

## Global Constraints

- Broadcasting is **best-effort**: a Reverb/queue outage must never fail a billing job or a use case. Wrap dispatches so an exception is swallowed/logged, never re-thrown.
- Scope is **live UI only** — no outbound HTTP webhooks, no customer-facing invoice UI in Flutter, no client push on invoice authorization (client keeps the existing email).
- Invoice push recipients = **tenant admins only** (roles `owner`, `tenant_admin`, `cashier`, `is_active` pivot true), on **both** `autorizada` and `rechazada`.
- FCM notifications keep the existing shape: `implements ShouldQueue`, `via() = ['database', FcmChannel::class]`, `toArray()` + `toFcm()` with keys `title, body, action_type, action_id, tenant_id, tenant_name, icon`. `FcmChannel` already enforces the `push_notifications` plan gate — do not re-check it.
- Channel names/payloads are a contract shared across all three apps: event `invoice.status.updated` on `private-tenant.{tenantId}`, payload keys `referenceType, referenceId, invoiceExternalId, status, numeroAutorizacion, claveAcceso`.
- Backend tests run with `cd apps/backend && ./vendor/bin/pest --filter=<name>`. Admin verified with `cd apps/admin-v2 && npx tsc --noEmit`. Flutter verified with `cd apps/customer_v2 && fvm flutter analyze` (no unit-test harness for the socket layer — the detail-screen behavior is verified manually).
- Commit after every task. Do NOT push/deploy — that is a separate explicit step at the end.

---

## File Structure

**Backend (`apps/backend/`)**
- Create `app/Events/InvoiceStatusUpdated.php` — the broadcast event (Task 1).
- Create `app/Infrastructure/Notifications/Notifications/InvoiceAuthorized.php` and `InvoiceRejected.php` — FCM notifications (Task 3).
- Modify the 4 invoice jobs in `app/Infrastructure/Jobs/` — dispatch event + notify admins (Tasks 2, 3).
- Modify `app/Application/UseCases/Reservation/CreateReservationUseCase.php` — broadcast on create (Task 4).
- Tests in `tests/Feature/Billing/InvoiceRealtimeTest.php` (Tasks 1–3) and `tests/Feature/Reservation/` (Task 4).

**Admin (`apps/admin-v2/`)**
- Modify `src/presentation/hooks/use-reservations-realtime.ts` — add the `.invoice.status.updated` listener on the same channel (Task 5).

**Flutter (`apps/customer_v2/`)**
- Modify `lib/core/realtime/pusher_service.dart` — expose a broadcast `Stream` of reservation updates (Task 6).
- Modify `lib/features/reservations/presentation/screens/reservation_detail_screen.dart` — subscribe and reload on matching id (Task 7).
- `lib/main.dart` `_RealtimeBridge` keeps working unchanged (still uses the callback, which stays).

---

## Task 1: `InvoiceStatusUpdated` broadcast event

**Files:**
- Create: `apps/backend/app/Events/InvoiceStatusUpdated.php`
- Test: `apps/backend/tests/Feature/Billing/InvoiceRealtimeTest.php`

**Interfaces:**
- Produces: `App\Events\InvoiceStatusUpdated` with public promoted props `string $tenantId, string $referenceType, string $referenceId, ?string $invoiceExternalId, string $status, ?string $numeroAutorizacion = null, ?string $claveAcceso = null`; `broadcastAs()` returns `'invoice.status.updated'`; broadcasts on `PrivateChannel("tenant.{$tenantId}")`.

- [ ] **Step 1: Write the failing test**

Create `apps/backend/tests/Feature/Billing/InvoiceRealtimeTest.php`:

```php
<?php

use App\Events\InvoiceStatusUpdated;
use Illuminate\Broadcasting\PrivateChannel;

test('InvoiceStatusUpdated broadcasts on the tenant channel with the invoice payload', function () {
    $event = new InvoiceStatusUpdated(
        tenantId: 'tenant-1',
        referenceType: 'reservation',
        referenceId: 'res-1',
        invoiceExternalId: 'inv-ext-1',
        status: 'autorizada',
        numeroAutorizacion: 'AUTH-123',
        claveAcceso: str_repeat('9', 49),
    );

    expect($event->broadcastAs())->toBe('invoice.status.updated');

    $channels = $event->broadcastOn();
    expect($channels)->toHaveCount(1)
        ->and($channels[0])->toBeInstanceOf(PrivateChannel::class)
        ->and($channels[0]->name)->toBe('private-tenant.tenant-1');

    expect($event->broadcastWith())->toBe([
        'referenceType'      => 'reservation',
        'referenceId'        => 'res-1',
        'invoiceExternalId'  => 'inv-ext-1',
        'status'             => 'autorizada',
        'numeroAutorizacion' => 'AUTH-123',
        'claveAcceso'        => str_repeat('9', 49),
    ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && ./vendor/bin/pest --filter="InvoiceStatusUpdated broadcasts"`
Expected: FAIL — class `App\Events\InvoiceStatusUpdated` not found.

- [ ] **Step 3: Write minimal implementation**

Create `apps/backend/app/Events/InvoiceStatusUpdated.php`:

```php
<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Broadcast when an invoice's SRI status changes (enviada → autorizada |
 * rechazada). Lets the admin update its Facturas list and the reservation /
 * service-log rows live, without navigating. Tenant channel only — the
 * customer app has no invoice UI.
 */
class InvoiceStatusUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public string $tenantId,
        public string $referenceType, // 'reservation' | 'service_log'
        public string $referenceId,
        public ?string $invoiceExternalId,
        public string $status,
        public ?string $numeroAutorizacion = null,
        public ?string $claveAcceso = null,
    ) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel("tenant.{$this->tenantId}")];
    }

    public function broadcastAs(): string
    {
        return 'invoice.status.updated';
    }

    public function broadcastWith(): array
    {
        return [
            'referenceType'      => $this->referenceType,
            'referenceId'        => $this->referenceId,
            'invoiceExternalId'  => $this->invoiceExternalId,
            'status'             => $this->status,
            'numeroAutorizacion' => $this->numeroAutorizacion,
            'claveAcceso'        => $this->claveAcceso,
        ];
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/backend && ./vendor/bin/pest --filter="InvoiceStatusUpdated broadcasts"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/app/Events/InvoiceStatusUpdated.php apps/backend/tests/Feature/Billing/InvoiceRealtimeTest.php
git commit -m "feat(billing): InvoiceStatusUpdated broadcast event"
```

---

## Task 2: Broadcast invoice status from the emit + sync jobs

**Files:**
- Modify: `apps/backend/app/Infrastructure/Jobs/EmitReservationInvoiceJob.php`
- Modify: `apps/backend/app/Infrastructure/Jobs/EmitServiceLogInvoiceJob.php`
- Modify: `apps/backend/app/Infrastructure/Jobs/SyncReservationInvoiceStatusJob.php`
- Modify: `apps/backend/app/Infrastructure/Jobs/SyncServiceLogInvoiceStatusJob.php`
- Test: `apps/backend/tests/Feature/Billing/InvoiceRealtimeTest.php`

**Interfaces:**
- Consumes: `App\Events\InvoiceStatusUpdated` (Task 1).
- Produces: each job dispatches `InvoiceStatusUpdated` after writing `invoice_status`.

- [ ] **Step 1: Write the failing tests**

Append to `apps/backend/tests/Feature/Billing/InvoiceRealtimeTest.php` (add the `beforeEach` + imports at the top of the file, merging with the existing `use` block):

```php
use App\Events\InvoiceStatusUpdated;
use App\Infrastructure\Billing\BillingServiceClient;
use App\Infrastructure\Jobs\EmitReservationInvoiceJob;
use App\Infrastructure\Jobs\SyncReservationInvoiceStatusJob;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;

beforeEach(function () {
    Mail::fake();
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

function realtimeReservation($self): ReservationModel
{
    return ReservationModel::factory()->create([
        'tenant_id'           => $self->tenant->id,
        'client_id'           => $self->user->id,
        'client_resource_id'  => $self->clientResource->id,
        'service_id'          => $self->service->id,
        'created_by'          => $self->user->id,
        'payment_method'      => 'cash',
        'status'              => 'completed',
        'invoice_external_id' => 'res-ext-1',
        'invoice_status'      => 'enviada',
    ]);
}

test('emit job broadcasts InvoiceStatusUpdated after writing status', function () {
    Event::fake([InvoiceStatusUpdated::class]);
    $reservation = ReservationModel::factory()->create([
        'tenant_id'          => $this->tenant->id,
        'client_id'          => $this->user->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id'         => $this->service->id,
        'created_by'         => $this->user->id,
        'payment_method'     => 'cash',
        'status'             => 'completed',
    ]);

    Http::fake(['*/api/invoices' => Http::response([
        'data' => ['id' => 'res-ext-1', 'estado' => 'enviada', 'clave_acceso' => str_repeat('1', 49)],
    ], 201)]);

    (new EmitReservationInvoiceJob($reservation->id))->handle(new BillingServiceClient());

    Event::assertDispatched(InvoiceStatusUpdated::class, fn ($e) =>
        $e->referenceType === 'reservation'
        && $e->referenceId === (string) $reservation->id
        && $e->status === 'enviada');
});

test('sync job broadcasts InvoiceStatusUpdated on autorizada', function () {
    Event::fake([InvoiceStatusUpdated::class]);
    $reservation = realtimeReservation($this);

    Http::fake(['*/api/invoices/res-ext-1' => Http::response([
        'data' => ['id' => 'res-ext-1', 'estado' => 'autorizada', 'numero_autorizacion' => 'AUTH-9'],
    ], 200)]);

    (new SyncReservationInvoiceStatusJob($reservation->id))->handle(new BillingServiceClient());

    Event::assertDispatched(InvoiceStatusUpdated::class, fn ($e) =>
        $e->referenceId === (string) $reservation->id && $e->status === 'autorizada');
});

test('sync job broadcasts InvoiceStatusUpdated on rechazada', function () {
    Event::fake([InvoiceStatusUpdated::class]);
    $reservation = realtimeReservation($this);

    Http::fake(['*/api/invoices/res-ext-1' => Http::response([
        'data' => ['id' => 'res-ext-1', 'estado' => 'rechazada', 'mensajes' => [['mensaje' => 'RUC inválido']]],
    ], 200)]);

    (new SyncReservationInvoiceStatusJob($reservation->id))->handle(new BillingServiceClient());

    Event::assertDispatched(InvoiceStatusUpdated::class, fn ($e) =>
        $e->referenceId === (string) $reservation->id && $e->status === 'rechazada');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/backend && ./vendor/bin/pest --filter="InvoiceStatusUpdated"`
Expected: the three new tests FAIL — no `InvoiceStatusUpdated` dispatched.

- [ ] **Step 3: Implement — EmitReservationInvoiceJob**

In `EmitReservationInvoiceJob.php`, add the import `use App\Events\InvoiceStatusUpdated;`. Inside `handle()`, immediately after the `$reservation->update([...])` block (the one setting `invoice_external_id` etc., before the `if (($result['estado'] ?? '') === 'autorizada')` branch), add:

```php
$this->broadcast($reservation);
```

Add a private method (best-effort, never throws):

```php
private function broadcast(ReservationModel $reservation): void
{
    try {
        InvoiceStatusUpdated::dispatch(
            (string) $reservation->tenant_id,
            'reservation',
            (string) $reservation->id,
            $reservation->invoice_external_id,
            (string) $reservation->invoice_status,
            $reservation->invoice_numero_autorizacion,
            $reservation->invoice_clave_acceso,
        );
    } catch (\Throwable $e) {
        \Illuminate\Support\Facades\Log::warning('InvoiceStatusUpdated broadcast failed', ['error' => $e->getMessage()]);
    }
}
```

Note: call `$this->broadcast($reservation)` after `$reservation->refresh()` is unnecessary — the `update()` already mutated the model instance, so its attributes are current.

- [ ] **Step 4: Implement — EmitServiceLogInvoiceJob**

Same pattern. Add `use App\Events\InvoiceStatusUpdated;`. After the `$log->update([...])` block, add `$this->broadcast($log);` and a private method using `'service_log'` and the log's fields:

```php
private function broadcast(\App\Infrastructure\Persistence\Models\ServiceLogModel $log): void
{
    try {
        InvoiceStatusUpdated::dispatch(
            (string) $log->tenant_id,
            'service_log',
            (string) $log->id,
            $log->invoice_external_id,
            (string) $log->invoice_status,
            $log->invoice_numero_autorizacion,
            $log->invoice_clave_acceso,
        );
    } catch (\Throwable $e) {
        \Illuminate\Support\Facades\Log::warning('InvoiceStatusUpdated broadcast failed', ['error' => $e->getMessage()]);
    }
}
```

- [ ] **Step 5: Implement — SyncReservationInvoiceStatusJob**

Add `use App\Events\InvoiceStatusUpdated;`. In `handle()`, inside the `if ($estado === 'autorizada')` branch after `$reservation->update([...])`, add `$this->broadcast($reservation);`. Inside the `if (in_array($estado, ['rechazada', ...]))` branch after `$reservation->update([...])`, add `$this->broadcast($reservation);`. Add the same private `broadcast(ReservationModel $reservation)` method shown in Step 3.

- [ ] **Step 6: Implement — SyncServiceLogInvoiceStatusJob**

Add `use App\Events\InvoiceStatusUpdated;`. Same as Step 5 but for `$log` with `'service_log'` — add `$this->broadcast($log);` in both the `autorizada` and `rechazada` branches, plus the private `broadcast(ServiceLogModel $log)` method from Step 4.

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd apps/backend && ./vendor/bin/pest --filter="InvoiceStatusUpdated"`
Expected: PASS (event test from Task 1 + the three dispatch tests).

- [ ] **Step 8: Run the existing invoice suite to check nothing broke**

Run: `cd apps/backend && ./vendor/bin/pest --filter="ReservationInvoice"`
Expected: PASS (unchanged behavior — the added broadcasts are additive).

- [ ] **Step 9: Commit**

```bash
git add apps/backend/app/Infrastructure/Jobs/EmitReservationInvoiceJob.php apps/backend/app/Infrastructure/Jobs/EmitServiceLogInvoiceJob.php apps/backend/app/Infrastructure/Jobs/SyncReservationInvoiceStatusJob.php apps/backend/app/Infrastructure/Jobs/SyncServiceLogInvoiceStatusJob.php apps/backend/tests/Feature/Billing/InvoiceRealtimeTest.php
git commit -m "feat(billing): broadcast InvoiceStatusUpdated from emit + sync jobs"
```

---

## Task 3: Admin FCM push on invoice authorized / rejected

**Files:**
- Create: `apps/backend/app/Infrastructure/Notifications/Notifications/InvoiceAuthorized.php`
- Create: `apps/backend/app/Infrastructure/Notifications/Notifications/InvoiceRejected.php`
- Modify: `apps/backend/app/Infrastructure/Jobs/SyncReservationInvoiceStatusJob.php`
- Modify: `apps/backend/app/Infrastructure/Jobs/SyncServiceLogInvoiceStatusJob.php`
- Modify: `apps/backend/app/Infrastructure/Jobs/EmitReservationInvoiceJob.php` (immediate-`autorizada` path)
- Modify: `apps/backend/app/Infrastructure/Jobs/EmitServiceLogInvoiceJob.php` (immediate-`autorizada` path)
- Test: `apps/backend/tests/Feature/Billing/InvoiceRealtimeTest.php`

**Interfaces:**
- Produces: `InvoiceAuthorized` and `InvoiceRejected`, constructed as
  `new InvoiceAuthorized(string $tenantId, string $tenantName, string $actionType, string $actionId, string $numeroAutorizacion)`
  and `new InvoiceRejected(string $tenantId, string $tenantName, string $actionType, string $actionId, ?string $reason)`.
  `actionType` is `'reservation_detail'` for reservation invoices (deep-links `/reservations/{id}`) and `'invoice'` for service-log invoices.
- Consumes: `App\Infrastructure\Notifications\Channels\FcmChannel`.

- [ ] **Step 1: Write the failing test**

Append to `apps/backend/tests/Feature/Billing/InvoiceRealtimeTest.php` (add `use App\Infrastructure\Notifications\Notifications\InvoiceAuthorized;`, `InvoiceRejected;`, and `use Illuminate\Support\Facades\Notification;`):

```php
test('sync job notifies tenant admins on autorizada', function () {
    Notification::fake();
    $admin = UserModel::factory()->create();
    $this->tenant->users()->attach($admin->id, ['role' => 'owner', 'is_active' => true]);
    $reservation = realtimeReservation($this);

    Http::fake(['*/api/invoices/res-ext-1' => Http::response([
        'data' => ['id' => 'res-ext-1', 'estado' => 'autorizada', 'numero_autorizacion' => 'AUTH-9'],
    ], 200)]);

    (new SyncReservationInvoiceStatusJob($reservation->id))->handle(new BillingServiceClient());

    Notification::assertSentTo($admin, InvoiceAuthorized::class);
});

test('sync job notifies tenant admins on rechazada', function () {
    Notification::fake();
    $admin = UserModel::factory()->create();
    $this->tenant->users()->attach($admin->id, ['role' => 'owner', 'is_active' => true]);
    $reservation = realtimeReservation($this);

    Http::fake(['*/api/invoices/res-ext-1' => Http::response([
        'data' => ['id' => 'res-ext-1', 'estado' => 'rechazada', 'mensajes' => [['mensaje' => 'RUC inválido']]],
    ], 200)]);

    (new SyncReservationInvoiceStatusJob($reservation->id))->handle(new BillingServiceClient());

    Notification::assertSentTo($admin, InvoiceRejected::class);
});
```

> NOTE for the implementer: verify the tenant↔user pivot column names against `TenantModel::users()` (roles + `is_active`). The attach args above mirror `CreateReservationUseCase` — adjust only if the pivot definition differs.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/backend && ./vendor/bin/pest --filter="notifies tenant admins"`
Expected: FAIL — notification classes not found / not sent.

- [ ] **Step 3: Create `InvoiceAuthorized`**

`apps/backend/app/Infrastructure/Notifications/Notifications/InvoiceAuthorized.php`:

```php
<?php

namespace App\Infrastructure\Notifications\Notifications;

use App\Infrastructure\Notifications\Channels\FcmChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class InvoiceAuthorized extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private string $tenantId,
        private string $tenantName,
        private string $actionType,
        private string $actionId,
        private string $numeroAutorizacion,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database', FcmChannel::class];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title'       => '✅ Factura autorizada',
            'body'        => "El SRI autorizó la factura N° {$this->numeroAutorizacion}.",
            'action_type' => $this->actionType,
            'action_id'   => $this->actionId,
            'tenant_id'   => $this->tenantId,
            'tenant_name' => $this->tenantName,
            'icon'        => 'check_circle',
        ];
    }

    public function toFcm(object $notifiable): array
    {
        $data = $this->toArray($notifiable);

        return [
            'notification' => ['title' => $data['title'], 'body' => $data['body']],
            'data'         => $data,
        ];
    }
}
```

- [ ] **Step 4: Create `InvoiceRejected`**

`apps/backend/app/Infrastructure/Notifications/Notifications/InvoiceRejected.php`:

```php
<?php

namespace App\Infrastructure\Notifications\Notifications;

use App\Infrastructure\Notifications\Channels\FcmChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class InvoiceRejected extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private string $tenantId,
        private string $tenantName,
        private string $actionType,
        private string $actionId,
        private ?string $reason,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database', FcmChannel::class];
    }

    public function toArray(object $notifiable): array
    {
        $reason = $this->reason ? " Motivo: {$this->reason}" : '';

        return [
            'title'       => '❌ Factura rechazada',
            'body'        => "El SRI rechazó la factura.{$reason}",
            'action_type' => $this->actionType,
            'action_id'   => $this->actionId,
            'tenant_id'   => $this->tenantId,
            'tenant_name' => $this->tenantName,
            'icon'        => 'error',
        ];
    }

    public function toFcm(object $notifiable): array
    {
        $data = $this->toArray($notifiable);

        return [
            'notification' => ['title' => $data['title'], 'body' => $data['body']],
            'data'         => $data,
        ];
    }
}
```

- [ ] **Step 5: Wire notifications into `SyncReservationInvoiceStatusJob`**

Add imports:

```php
use App\Infrastructure\Notifications\Notifications\InvoiceAuthorized;
use App\Infrastructure\Notifications\Notifications\InvoiceRejected;
use App\Infrastructure\Persistence\Models\TenantModel;
use Illuminate\Support\Facades\Notification;
```

In the `autorizada` branch, after the existing email queue, add:

```php
$this->notifyAdmins($reservation->tenant_id, new InvoiceAuthorized(
    (string) $reservation->tenant_id,
    $this->tenantName($reservation->tenant_id),
    'reservation_detail',
    (string) $reservation->id,
    (string) ($reservation->invoice_numero_autorizacion ?? ($inv['numero_autorizacion'] ?? '')),
));
```

In the `rechazada` branch, after `$reservation->update([...])`, add:

```php
$this->notifyAdmins($reservation->tenant_id, new InvoiceRejected(
    (string) $reservation->tenant_id,
    $this->tenantName($reservation->tenant_id),
    'reservation_detail',
    (string) $reservation->id,
    $this->firstMessage($inv),
));
```

Add two private helpers (best-effort — a notification failure must not fail the job):

```php
private function notifyAdmins(string $tenantId, \Illuminate\Notifications\Notification $notification): void
{
    try {
        $admins = TenantModel::find($tenantId)?->users()
            ->wherePivotIn('role', ['owner', 'tenant_admin', 'cashier'])
            ->wherePivot('is_active', true)
            ->get();

        if ($admins && $admins->isNotEmpty()) {
            Notification::send($admins, $notification);
        }
    } catch (\Throwable $e) {
        \Illuminate\Support\Facades\Log::warning('Invoice admin notification failed', ['error' => $e->getMessage()]);
    }
}

private function tenantName(string $tenantId): string
{
    return (string) (TenantModel::find($tenantId)?->name ?? '');
}
```

- [ ] **Step 6: Wire notifications into `SyncServiceLogInvoiceStatusJob`**

Same imports and helpers. Use `'invoice'` as `actionType` and the log id as `actionId`:

```php
// autorizada branch:
$this->notifyAdmins($log->tenant_id, new InvoiceAuthorized(
    (string) $log->tenant_id,
    $this->tenantName($log->tenant_id),
    'invoice',
    (string) $log->id,
    (string) ($log->invoice_numero_autorizacion ?? ($inv['numero_autorizacion'] ?? '')),
));

// rechazada branch:
$this->notifyAdmins($log->tenant_id, new InvoiceRejected(
    (string) $log->tenant_id,
    $this->tenantName($log->tenant_id),
    'invoice',
    (string) $log->id,
    $this->firstMessage($inv),
));
```

- [ ] **Step 7: Wire the immediate-`autorizada` path in both Emit jobs**

In `EmitReservationInvoiceJob.php`, inside the existing `if (($result['estado'] ?? '') === 'autorizada')` branch, after the email queue, add the same `notifyAdmins(...)` + `new InvoiceAuthorized(...)` call (actionType `'reservation_detail'`, actionId `$reservation->id`, numero `$result['numero_autorizacion'] ?? ''`). Add the imports + the `notifyAdmins`/`tenantName` private helpers (copy from Step 5). In `EmitServiceLogInvoiceJob.php` do the same with actionType `'invoice'` and actionId `$log->id`.

> The Emit jobs have no `rechazada`-branch notification (their catch block sets `rechazada` from a transport exception, not an SRI verdict; SRI rejections surface later through the Sync job, which already notifies).

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd apps/backend && ./vendor/bin/pest --filter="InvoiceRealtimeTest"`
Expected: all tests PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/backend/app/Infrastructure/Notifications/Notifications/InvoiceAuthorized.php apps/backend/app/Infrastructure/Notifications/Notifications/InvoiceRejected.php apps/backend/app/Infrastructure/Jobs/SyncReservationInvoiceStatusJob.php apps/backend/app/Infrastructure/Jobs/SyncServiceLogInvoiceStatusJob.php apps/backend/app/Infrastructure/Jobs/EmitReservationInvoiceJob.php apps/backend/app/Infrastructure/Jobs/EmitServiceLogInvoiceJob.php apps/backend/tests/Feature/Billing/InvoiceRealtimeTest.php
git commit -m "feat(billing): FCM push to admins on invoice authorized/rejected"
```

---

## Task 4: Broadcast `ReservationUpdated` on reservation create

**Files:**
- Modify: `apps/backend/app/Application/UseCases/Reservation/CreateReservationUseCase.php`
- Test: `apps/backend/tests/Feature/Reservation/CreateReservationBroadcastTest.php`

**Interfaces:**
- Consumes: existing `App\Events\ReservationUpdated` (constructor takes a `ReservationModel`).

- [ ] **Step 1: Write the failing test**

Create `apps/backend/tests/Feature/Reservation/CreateReservationBroadcastTest.php`. Model the arrange block on `CheckInBillingProfileTest` (tenant/service/clientResource factories + `current_tenant` bindings + an active `AvailabilitySlotModel` covering the scheduled time, since `CreateReservationUseCase` enforces business hours). Then:

```php
use App\Application\DTOs\Reservation\CreateReservationDTO;
use App\Application\UseCases\Reservation\CreateReservationUseCase;
use App\Events\ReservationUpdated;
use Illuminate\Support\Facades\Event;

test('creating a reservation broadcasts ReservationUpdated', function () {
    Event::fake([ReservationUpdated::class]);

    $useCase = app(CreateReservationUseCase::class);
    $useCase->execute(new CreateReservationDTO(
        // fill from the DTO's constructor: tenantId, clientId, clientResourceId,
        // serviceId, scheduledAt (within the active slot), createdBy, etc.
        // Copy the exact field set from an existing CreateReservationDTO usage
        // (grep `new CreateReservationDTO(` in the controllers/tests).
    ));

    Event::assertDispatched(ReservationUpdated::class);
});
```

> The implementer must fill the DTO from its actual constructor + create a matching active `AvailabilitySlotModel`. Grep `new CreateReservationDTO(` and an existing reservation-creation test to copy the exact arrange.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && ./vendor/bin/pest --filter="broadcasts ReservationUpdated"`
Expected: FAIL — no `ReservationUpdated` dispatched.

- [ ] **Step 3: Implement**

In `CreateReservationUseCase.php`, add `use App\Events\ReservationUpdated;`. Inside the existing `try { ... }` block, after `Notification::send($admins, new NewReservationForAdmin($model));` (still inside the `if ($model)` guard), add:

```php
ReservationUpdated::dispatch($model);
```

This reuses the existing best-effort `try/catch` around the notification, so a broadcast failure is already logged and swallowed.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/backend && ./vendor/bin/pest --filter="broadcasts ReservationUpdated"`
Expected: PASS.

- [ ] **Step 5: Run the reservation suite for regressions**

Run: `cd apps/backend && ./vendor/bin/pest tests/Feature/Reservation`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/app/Application/UseCases/Reservation/CreateReservationUseCase.php apps/backend/tests/Feature/Reservation/CreateReservationBroadcastTest.php
git commit -m "feat(reservation): broadcast ReservationUpdated on create"
```

---

## Task 5: Admin — invalidate invoices live on `invoice.status.updated`

**Files:**
- Modify: `apps/admin-v2/src/presentation/hooks/use-reservations-realtime.ts`

**Interfaces:**
- Consumes: broadcast event `invoice.status.updated` on `private-tenant.{tenantId}` (Task 1/2 contract).

- [ ] **Step 1: Add the invoice listener**

In `use-reservations-realtime.ts`, add an `InvoiceStatusUpdatedPayload` type and a second `channel.listen` on the SAME channel object, before the `return` cleanup:

```ts
interface InvoiceStatusUpdatedPayload {
  referenceType: 'reservation' | 'service_log';
  referenceId: string;
  invoiceExternalId: string | null;
  status: string;
  numeroAutorizacion: string | null;
  claveAcceso: string | null;
}
```

Inside the `useEffect`, after the existing `channel.listen('.reservation.updated', ...)` block:

```ts
channel.listen('.invoice.status.updated', (payload: InvoiceStatusUpdatedPayload) => {
  queryClient.invalidateQueries({ queryKey: ['invoices'] });
  queryClient.invalidateQueries({ queryKey: ['service-logs'] });
  queryClient.invalidateQueries({ queryKey: ['reservations'] });
  if (payload?.referenceType === 'reservation' && payload.referenceId) {
    queryClient.invalidateQueries({ queryKey: ['reservation', payload.referenceId] });
  }
});
```

The existing `echo.leave(...)` cleanup already tears down both listeners with the channel.

Also update the hook's JSDoc comment to mention it now carries both `reservation.updated` and `invoice.status.updated`.

- [ ] **Step 2: Typecheck**

Run: `cd apps/admin-v2 && npx tsc --noEmit`
Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/admin-v2/src/presentation/hooks/use-reservations-realtime.ts
git commit -m "feat(admin): live-invalidate invoices on invoice.status.updated"
```

- [ ] **Step 4: Manual verification (after deploy, or against a local stack with Reverb)**

Open the Facturas page. Emit an invoice for a reservation/registro. Without navigating, the row should flip `enviada → autorizada` within a few seconds. A rejected invoice should flip to `rechazada`. If nothing changes, confirm the admin's `NEXT_PUBLIC_REVERB_*` env points at `wss://api.goturnly.com/app` (scheme `https`) so the socket isn't blocked as mixed content.

---

## Task 6: Flutter — expose a broadcast `Stream` from `PusherService`

**Files:**
- Modify: `apps/customer_v2/lib/core/realtime/pusher_service.dart`

**Interfaces:**
- Produces: `Stream<Map<String, dynamic>> get reservationUpdates` on `PusherService.instance`, emitting each `reservation.updated` payload. The existing `ReservationUpdatedCallback` still fires (unchanged for `main.dart`).

- [ ] **Step 1: Add a broadcast StreamController**

At the top of the `PusherService` class body (after the existing fields), add:

```dart
final StreamController<Map<String, dynamic>> _reservationUpdatesController =
    StreamController<Map<String, dynamic>>.broadcast();

/// Fires the full payload of every `reservation.updated` event. Multiple
/// widgets can listen (e.g. the reservations list AND an open detail screen).
Stream<Map<String, dynamic>> get reservationUpdates =>
    _reservationUpdatesController.stream;
```

Add `import 'dart:async';` at the top of the file.

- [ ] **Step 2: Emit to the stream inside `onEvent`**

In the `onEvent` handler, in the `if (event.eventName == 'reservation.updated')` block, emit to the stream in addition to calling the callback. Replace the block body with:

```dart
final data = event.data;
Map<String, dynamic> payload;
if (data is Map<String, dynamic>) {
  payload = data;
} else if (data is String) {
  payload = {'raw': data};
} else {
  payload = <String, dynamic>{};
}
_onReservationUpdated?.call(payload);
if (!_reservationUpdatesController.isClosed) {
  _reservationUpdatesController.add(payload);
}
```

- [ ] **Step 3: Analyze**

Run: `cd apps/customer_v2 && fvm flutter analyze lib/core/realtime/pusher_service.dart`
Expected: no new issues (the `StreamController` is intentionally long-lived for the singleton; do NOT close it in `stop()` — the socket restarts across logins).

- [ ] **Step 4: Commit**

```bash
git add apps/customer_v2/lib/core/realtime/pusher_service.dart
git commit -m "feat(customer): expose reservationUpdates stream on PusherService"
```

---

## Task 7: Flutter — reservation detail screen updates live

**Files:**
- Modify: `apps/customer_v2/lib/features/reservations/presentation/screens/reservation_detail_screen.dart`

**Interfaces:**
- Consumes: `PusherService.instance.reservationUpdates` (Task 6).

- [ ] **Step 1: Subscribe in `initState`, reload on matching id**

Add imports:

```dart
import 'dart:async';
import '../../../../core/realtime/pusher_service.dart';
```

In `_ReservationDetailScreenState`, add a field:

```dart
StreamSubscription<Map<String, dynamic>>? _updatesSub;
```

In `initState`, after `_loadReservation();`, add:

```dart
_updatesSub = PusherService.instance.reservationUpdates.listen((payload) {
  final id = payload['id']?.toString();
  if (id == widget.reservationId && mounted) {
    _loadReservation();
  }
});
```

Add/extend `dispose`:

```dart
@override
void dispose() {
  _updatesSub?.cancel();
  super.dispose();
}
```

- [ ] **Step 2: Analyze**

Run: `cd apps/customer_v2 && fvm flutter analyze lib/features/reservations/presentation/screens/reservation_detail_screen.dart`
Expected: no new issues.

- [ ] **Step 3: Commit**

```bash
git add apps/customer_v2/lib/features/reservations/presentation/screens/reservation_detail_screen.dart
git commit -m "feat(customer): reservation detail updates live via socket"
```

- [ ] **Step 4: Manual verification**

Log in on the Flutter app, open a reservation's detail. From the admin, change that reservation's status (e.g. check-in → started). The detail screen should refresh its status without a pull-to-refresh.

---

## Deploy (separate, explicit step — do NOT run during task execution)

Backend changes (`apps/backend/**`): push `develop` → dev, then merge `develop`→`main` → prod (see the deploy-pipeline memory). Admin (`apps/admin-v2/**`): rides the same pushes via Vercel. Flutter: ships in the next app build (no CI auto-deploy). After deploy, run the Task 5 and Task 7 manual verifications on dev first, then prod.

---

## Self-Review

- **Spec coverage:** Feature 1 (invoice broadcast) → Tasks 1, 2, 5. Feature 2 (admin push) → Task 3. Feature 3 (Flutter detail live) → Tasks 6, 7. Feature 4 (reservation created broadcast) → Task 4. All spec features covered.
- **Out-of-scope respected:** no outbound webhooks, no Flutter invoice UI, no client invoice push — none introduced.
- **Type/name consistency:** event name `invoice.status.updated` and payload keys (`referenceType, referenceId, invoiceExternalId, status, numeroAutorizacion, claveAcceso`) match across Task 1 (`broadcastWith`), Task 2 (dispatch args order), and Task 5 (TS interface). Notification constructor signatures in Task 3 match their call sites. `reservationUpdates` stream name matches between Task 6 (producer) and Task 7 (consumer).
- **Best-effort dispatch:** every broadcast/notify call is wrapped in try/catch or sits inside an existing one (Task 4).
