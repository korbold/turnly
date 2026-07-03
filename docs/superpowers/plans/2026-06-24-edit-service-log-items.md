# Edit Service Log Items Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow cashiers to add, remove, and reprice services on an existing service log entry from the admin daily-log view.

**Architecture:** Backend gets a new `PUT /service-logs/{id}/items` endpoint that replaces the items list atomically (delete-all + re-insert) and re-derives the parent log's `service_id` and `price_charged`. Frontend expands the existing `EditServiceLogDialog` with the same `ServiceCombobox` + line-item editor already used in `NewServiceModal`, then calls both the existing `PATCH /service-logs/{id}` (for attendant/notes) and the new items endpoint in parallel on save.

**Tech Stack:** Laravel 13 (backend), Next.js 16 / React / TypeScript (admin), React Query, Tailwind v4, shadcn/ui

## Global Constraints

- Laravel: follow existing controller pattern in `ServiceLogController` — no new classes, inline method
- Multi-tenancy: all queries must use `TenantScope` (already on model via `BelongsToTenant`); never bypass it
- Frontend: clean architecture layers — domain repo interface → use-case → hook → component
- No new npm packages
- Tests: Pest (backend), no frontend tests required for this feature

---

## File Map

**Backend (new/modified):**
- Modify: `apps/backend/app/Infrastructure/Http/Controllers/ServiceLog/ServiceLogController.php` — add `updateItems()` method
- Modify: `apps/backend/routes/api.php` — register `PUT service-logs/{id}/items`
- Modify: `apps/backend/tests/Feature/ServiceLog/ServiceLogTest.php` — add `updateItems` tests

**Frontend (new/modified):**
- Modify: `apps/admin-v2/src/domain/repositories/service-log.repository.ts` — add `UpdateServiceLogItemsData` + `updateItems()` to interface
- Create: `apps/admin-v2/src/application/use-cases/service-logs/update-service-log-items.use-case.ts`
- Modify: `apps/admin-v2/src/infrastructure/api/repositories/api-service-log.repository.ts` — implement `updateItems()`
- Modify: `apps/admin-v2/src/presentation/hooks/use-service-logs.ts` — add `useUpdateServiceLogItems()`
- Modify: `apps/admin-v2/src/presentation/components/features/service-logs/edit-service-log-dialog.tsx` — add service picker + line items

---

## Task 1: Backend — `PUT /service-logs/{id}/items` endpoint

**Files:**
- Modify: `apps/backend/app/Infrastructure/Http/Controllers/ServiceLog/ServiceLogController.php`
- Modify: `apps/backend/routes/api.php`

**Interfaces:**
- Produces: `PUT /api/v1/service-logs/{id}/items` accepting `{ items: [{ service_id, variant_id?, label, qty, unit_price }] }`, returns `ServiceLogResource` with `items` eager-loaded

- [ ] **Step 1: Write the failing test first**

Add to `apps/backend/tests/Feature/ServiceLog/ServiceLogTest.php`:

```php
test('can update service log items — replaces existing items', function () {
    $serviceLog = ServiceLogModel::factory()->create([
        'tenant_id'          => $this->tenant->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id'         => $this->service->id,
        'attended_by'        => $this->user->id,
        'created_by'         => $this->user->id,
        'price_charged'      => 30.00,
    ]);

    $service2 = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->putJson("/api/v1/service-logs/{$serviceLog->id}/items", [
            'items' => [
                [
                    'service_id'  => $this->service->id,
                    'variant_id'  => null,
                    'label'       => 'Lavada básica',
                    'qty'         => 1,
                    'unit_price'  => 15.00,
                ],
                [
                    'service_id'  => $service2->id,
                    'variant_id'  => null,
                    'label'       => 'Pulido',
                    'qty'         => 1,
                    'unit_price'  => 25.00,
                ],
            ],
        ]);

    $response->assertOk()
        ->assertJsonPath('data.price_charged', 40.0)
        ->assertJsonPath('data.service_id', $this->service->id)
        ->assertJsonCount(2, 'data.items');

    $this->assertDatabaseCount('service_log_items', 2);
    $this->assertDatabaseHas('service_log_items', [
        'service_log_id' => $serviceLog->id,
        'label'          => 'Pulido',
    ]);
});

test('update items replaces all — old items are gone', function () {
    $serviceLog = ServiceLogModel::factory()->create([
        'tenant_id'          => $this->tenant->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id'         => $this->service->id,
        'attended_by'        => $this->user->id,
        'created_by'         => $this->user->id,
        'price_charged'      => 30.00,
    ]);

    // Seed an existing item
    \App\Infrastructure\Persistence\Models\ServiceLogItemModel::create([
        'tenant_id'      => $this->tenant->id,
        'service_log_id' => $serviceLog->id,
        'item_type'      => 'service_variant',
        'ref_id'         => $this->service->id,
        'label'          => 'Old item',
        'qty'            => 1,
        'unit_price'     => 30.00,
        'line_total'     => 30.00,
        'sort_order'     => 0,
    ]);

    $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->putJson("/api/v1/service-logs/{$serviceLog->id}/items", [
            'items' => [
                [
                    'service_id'  => $this->service->id,
                    'variant_id'  => null,
                    'label'       => 'New item',
                    'qty'         => 1,
                    'unit_price'  => 20.00,
                ],
            ],
        ]);

    $this->assertDatabaseMissing('service_log_items', ['label' => 'Old item']);
    $this->assertDatabaseHas('service_log_items', ['label' => 'New item']);
});

test('update items rejects empty items array', function () {
    $serviceLog = ServiceLogModel::factory()->create([
        'tenant_id'          => $this->tenant->id,
        'client_resource_id' => $this->clientResource->id,
        'service_id'         => $this->service->id,
        'attended_by'        => $this->user->id,
        'created_by'         => $this->user->id,
        'price_charged'      => 30.00,
    ]);

    $response = $this->actingAs($this->user)
        ->withHeader('X-Tenant', $this->tenant->slug)
        ->putJson("/api/v1/service-logs/{$serviceLog->id}/items", ['items' => []]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['items']);
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd apps/backend
php artisan test --filter="can update service log items"
```

Expected: FAIL — method/route not found (404 or MethodNotAllowedHttpException)

- [ ] **Step 3: Register the route**

In `apps/backend/routes/api.php`, after the existing `patch('service-logs/{id}', ...)` line (around line 168):

```php
Route::put('service-logs/{id}/items', [ServiceLogController::class, 'updateItems']);
```

- [ ] **Step 4: Add `updateItems()` to the controller**

In `apps/backend/app/Infrastructure/Http/Controllers/ServiceLog/ServiceLogController.php`, add this method after `update()` (around line 172):

```php
public function updateItems(Request $request, string $id): ServiceLogResource
{
    $serviceLog = ServiceLogModel::findOrFail($id);

    $request->validate([
        'items'                  => 'required|array|min:1',
        'items.*.service_id'     => 'required|uuid',
        'items.*.variant_id'     => 'nullable|uuid',
        'items.*.label'          => 'required|string|max:200',
        'items.*.qty'            => 'required|numeric|min:0.01',
        'items.*.unit_price'     => 'required|numeric|min:0',
    ]);

    $items = $request->input('items');
    $tenantId = app('current_tenant_id');

    // Replace all items atomically — delete then re-insert so sort
    // order resets cleanly and orphaned rows can never accumulate.
    $serviceLog->items()->delete();

    $sort = 0;
    foreach ($items as $line) {
        $unit   = (float) $line['unit_price'];
        $qty    = (float) $line['qty'];
        $refId  = !empty($line['variant_id']) ? $line['variant_id'] : $line['service_id'];

        \App\Infrastructure\Persistence\Models\ServiceLogItemModel::create([
            'tenant_id'      => $tenantId,
            'service_log_id' => $serviceLog->id,
            'item_type'      => 'service_variant',
            'ref_id'         => $refId,
            'label'          => $line['label'],
            'qty'            => $qty,
            'unit_price'     => $unit,
            'line_total'     => $unit * $qty,
            'sort_order'     => $sort++,
        ]);
    }

    // Re-derive parent columns from the new item list so legacy
    // queries (reports grouping by service_id) remain correct.
    $newTotal       = array_sum(array_map(fn ($it) => (float) $it['unit_price'] * (float) $it['qty'], $items));
    $firstVariantId = $items[0]['variant_id'] ?? null;
    $serviceLog->update([
        'service_id'         => $items[0]['service_id'],
        'price_charged'      => $newTotal,
        'service_variant_id' => $firstVariantId,
    ]);

    return new ServiceLogResource(
        $serviceLog->load(['clientResource', 'service', 'attendant', 'items'])
    );
}
```

- [ ] **Step 5: Run the tests — all three should pass**

```bash
cd apps/backend
php artisan test --filter="update service log items\|update items replaces\|update items rejects"
```

Expected: 3 PASS

- [ ] **Step 6: Run full test suite — no regressions**

```bash
cd apps/backend
composer test
```

Expected: all green

- [ ] **Step 7: Commit**

```bash
git add apps/backend/routes/api.php \
        apps/backend/app/Infrastructure/Http/Controllers/ServiceLog/ServiceLogController.php \
        apps/backend/tests/Feature/ServiceLog/ServiceLogTest.php
git commit -m "feat(backend): PUT /service-logs/{id}/items — replace item list atomically"
```

---

## Task 2: Frontend domain + infra layer

**Files:**
- Modify: `apps/admin-v2/src/domain/repositories/service-log.repository.ts`
- Create: `apps/admin-v2/src/application/use-cases/service-logs/update-service-log-items.use-case.ts`
- Modify: `apps/admin-v2/src/infrastructure/api/repositories/api-service-log.repository.ts`
- Modify: `apps/admin-v2/src/presentation/hooks/use-service-logs.ts`

**Interfaces:**
- Consumes: `PUT /api/v1/service-logs/{id}/items` from Task 1
- Produces:
  - `UpdateServiceLogItemsData` type (exported from `service-log.repository.ts`)
  - `useUpdateServiceLogItems()` hook returning `UseMutationResult<ServiceLog, Error, { id: string; items: UpdateServiceLogItemsData }>`

- [ ] **Step 1: Add `UpdateServiceLogItemsData` to the domain repo interface**

In `apps/admin-v2/src/domain/repositories/service-log.repository.ts`, add after the `UpdateServiceLogData` interface:

```typescript
export interface ServiceLogItemDraft {
  serviceId: string;
  variantId: string | null;
  label: string;
  qty: number;
  unitPrice: number;
}

export type UpdateServiceLogItemsData = ServiceLogItemDraft[];
```

Also add `updateItems(id: string, items: UpdateServiceLogItemsData): Promise<ServiceLog>;` to the `ServiceLogRepository` interface:

```typescript
export interface ServiceLogRepository {
  getAll(filters: ServiceLogFilters): Promise<PaginatedResult<ServiceLog>>;
  getById(id: string): Promise<ServiceLog>;
  create(data: CreateServiceLogData): Promise<ServiceLog>;
  update(id: string, data: UpdateServiceLogData): Promise<ServiceLog>;
  updateItems(id: string, items: UpdateServiceLogItemsData): Promise<ServiceLog>;
  delete(id: string): Promise<void>;
  complete(id: string): Promise<ServiceLog>;
  recordPayment(id: string, data: RecordPaymentData): Promise<ServiceLog>;
  getSummary(date: string): Promise<DailySummary>;
}
```

- [ ] **Step 2: Create the use case**

Create `apps/admin-v2/src/application/use-cases/service-logs/update-service-log-items.use-case.ts`:

```typescript
import type { ServiceLogRepository, UpdateServiceLogItemsData } from '@/domain/repositories/service-log.repository';

export class UpdateServiceLogItemsUseCase {
  constructor(private repo: ServiceLogRepository) {}

  execute(id: string, items: UpdateServiceLogItemsData) {
    return this.repo.updateItems(id, items);
  }
}
```

- [ ] **Step 3: Implement `updateItems` in the API repository**

In `apps/admin-v2/src/infrastructure/api/repositories/api-service-log.repository.ts`, add this method to `ApiServiceLogRepository` (after `update()`):

```typescript
async updateItems(id: string, items: UpdateServiceLogItemsData): Promise<ServiceLog> {
  const { data: res } = await api.put(`/service-logs/${id}/items`, {
    items: items.map((it) => ({
      service_id:  it.serviceId,
      variant_id:  it.variantId ?? null,
      label:       it.label,
      qty:         it.qty,
      unit_price:  it.unitPrice,
    })),
  });
  return mapServiceLog(res.data);
}
```

Also update the import at the top of this file to include `UpdateServiceLogItemsData`:

```typescript
import type {
  ServiceLogRepository,
  CreateServiceLogData,
  UpdateServiceLogData,
  UpdateServiceLogItemsData,
  RecordPaymentData,
} from '@/domain/repositories/service-log.repository';
```

- [ ] **Step 4: Add the hook**

In `apps/admin-v2/src/presentation/hooks/use-service-logs.ts`, add after `useUpdateServiceLog()`:

```typescript
export function useUpdateServiceLogItems() {
  const repo = useRepository('serviceLog');
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, items }: { id: string; items: UpdateServiceLogItemsData }) =>
      new UpdateServiceLogItemsUseCase(repo).execute(id, items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-logs'] });
    },
  });
}
```

Add the two new imports at the top of the hook file:

```typescript
import { UpdateServiceLogItemsUseCase } from '@/application/use-cases/service-logs/update-service-log-items.use-case';
import type { UpdateServiceLogItemsData } from '@/domain/repositories/service-log.repository';
```

- [ ] **Step 5: Type-check**

```bash
cd apps/admin-v2
npx tsc --noEmit 2>&1 | grep -E "error TS"
```

Expected: no output (zero errors)

- [ ] **Step 6: Commit**

```bash
git add apps/admin-v2/src/domain/repositories/service-log.repository.ts \
        apps/admin-v2/src/application/use-cases/service-logs/update-service-log-items.use-case.ts \
        apps/admin-v2/src/infrastructure/api/repositories/api-service-log.repository.ts \
        apps/admin-v2/src/presentation/hooks/use-service-logs.ts
git commit -m "feat(admin): domain + infra layer for updateItems on service logs"
```

---

## Task 3: Frontend — expand `EditServiceLogDialog` with item editor

**Files:**
- Modify: `apps/admin-v2/src/presentation/components/features/service-logs/edit-service-log-dialog.tsx`

**Interfaces:**
- Consumes: `useUpdateServiceLogItems()` from Task 2, `useUpdateServiceLog()` (existing), `useServices()` (existing), `ServiceCombobox` (existing at `@/presentation/components/features/service-logs/service-combobox`), `fetchVariantsForService` and `fetchSuggestedVariant` (defined in `new-service-modal.tsx` — copy the async functions into this file)

- [ ] **Step 1: Rewrite `EditServiceLogDialog`**

Replace the entire contents of `apps/admin-v2/src/presentation/components/features/service-logs/edit-service-log-dialog.tsx` with:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Banknote, CreditCard, ArrowLeftRight, MoreHorizontal, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';
import { Textarea } from '@/presentation/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select';
import { cn } from '@/shared/utils/cn';
import { useUpdateServiceLog, useUpdateServiceLogItems } from '@/presentation/hooks/use-service-logs';
import { useTeam } from '@/presentation/hooks/use-team';
import { useServices } from '@/presentation/hooks/use-services';
import { BankChip } from '@/presentation/components/features/reservations/bank-chip';
import { ECUADOR_BANKS } from '@/shared/constants/banks';
import { ServiceCombobox } from '@/presentation/components/features/service-logs/service-combobox';
import type { PaymentMethod, ServiceLog } from '@/domain/entities/service-log';
import type { Service } from '@/domain/entities/service';

// ─── types ───────────────────────────────────────────────────────────────────

interface LineItem {
  serviceId: string;
  serviceName: string;
  variantId: string | null;
  variantLabel: string | null;
  qty: number;
  unitPrice: number;
  availableVariants: ServiceVariantSlim[] | null;
}

interface ServiceVariantSlim {
  id: string;
  label: string;
  price: number;
}

// ─── helpers (mirrors new-service-modal.tsx) ─────────────────────────────────

async function fetchVariantsForService(serviceId: string): Promise<ServiceVariantSlim[]> {
  const { default: api } = await import('@/infrastructure/api/client');
  const { data: res } = await api.get(`/services/${serviceId}/variants`);
  const raw = (res.data ?? []) as Array<Record<string, unknown>>;
  return raw
    .filter((v) => v.is_active !== false)
    .map((v) => ({
      id: String(v.id),
      label: String(v.label ?? ''),
      price: Number(v.price ?? 0),
    }));
}

// ─── constants ────────────────────────────────────────────────────────────────

const METHODS: { value: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { value: 'cash', label: 'Efectivo', icon: Banknote },
  { value: 'card', label: 'Tarjeta', icon: CreditCard },
  { value: 'transfer', label: 'Transferencia', icon: ArrowLeftRight },
  { value: 'other', label: 'Otro', icon: MoreHorizontal },
];

// ─── component ────────────────────────────────────────────────────────────────

interface Props {
  log: ServiceLog | null;
  open: boolean;
  onClose: () => void;
}

export function EditServiceLogDialog({ log, open, onClose }: Props) {
  const [attendedBy, setAttendedBy] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentBank, setPaymentBank] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  const updateLog = useUpdateServiceLog();
  const updateItems = useUpdateServiceLogItems();
  const { data: teamData } = useTeam({ excludeRole: 'client' as const });
  const { data: servicesData, isLoading: servicesLoading } = useServices();
  const team = teamData?.data ?? [];
  const services = servicesData?.data ?? [];

  const total = lineItems.reduce((acc, it) => acc + it.unitPrice * it.qty, 0);
  const isPaid = log?.paymentStatus === 'paid';

  // Seed state from the log when the dialog opens
  useEffect(() => {
    if (!open || !log) return;
    setAttendedBy(log.attendedBy ?? '');
    setPaymentMethod(log.paymentMethod ?? 'cash');
    setPaymentBank(log.paymentBank ?? null);
    setNotes(log.notes ?? '');

    // Build line items from log.items (multi-service) or fall back to
    // the single service on the parent row (legacy logs with no items).
    if (log.items && log.items.length > 0) {
      setLineItems(
        log.items.map((it) => ({
          serviceId:         it.refId,
          serviceName:       it.label.replace(/\s·\s.*$/u, ''),
          variantId:         it.refId !== it.refId ? it.refId : null,
          variantLabel:      it.label.includes(' · ') ? it.label.split(' · ')[1] : null,
          qty:               it.qty,
          unitPrice:         it.unitPrice,
          availableVariants: [],
        }))
      );
    } else if (log.serviceId) {
      setLineItems([{
        serviceId:         log.serviceId,
        serviceName:       log.service?.name ?? 'Servicio',
        variantId:         null,
        variantLabel:      null,
        qty:               1,
        unitPrice:         log.priceCharged,
        availableVariants: [],
      }]);
    } else {
      setLineItems([]);
    }
  }, [open, log]);

  useEffect(() => {
    if (paymentMethod !== 'transfer') setPaymentBank(null);
  }, [paymentMethod]);

  // ── line item mutations ──────────────────────────────────────────────────

  async function handleAddLineItem(svc: Service) {
    const existing = lineItems.find((it) => it.serviceId === svc.id);
    if (existing) {
      setLineItems((prev) =>
        prev.map((it) => it.serviceId === svc.id ? { ...it, qty: it.qty + 1 } : it)
      );
      return;
    }

    setLineItems((prev) => [
      ...prev,
      {
        serviceId:         svc.id,
        serviceName:       svc.name,
        variantId:         null,
        variantLabel:      null,
        qty:               1,
        unitPrice:         svc.price,
        availableVariants: null,
      },
    ]);

    const variants = await fetchVariantsForService(svc.id);
    setLineItems((prev) =>
      prev.map((it) =>
        it.serviceId === svc.id ? { ...it, availableVariants: variants } : it
      )
    );
  }

  function handleRemoveLineItem(serviceId: string) {
    setLineItems((prev) => prev.filter((it) => it.serviceId !== serviceId));
  }

  function handleUpdateLineItem(serviceId: string, patch: Partial<Omit<LineItem, 'serviceId' | 'serviceName'>>) {
    setLineItems((prev) =>
      prev.map((it) => it.serviceId === serviceId ? { ...it, ...patch } : it)
    );
  }

  function handlePickVariant(serviceId: string, variant: ServiceVariantSlim) {
    setLineItems((prev) =>
      prev.map((it) =>
        it.serviceId === serviceId
          ? { ...it, variantId: variant.id, variantLabel: variant.label, unitPrice: variant.price }
          : it
      )
    );
  }

  // ── submit ───────────────────────────────────────────────────────────────

  function handleSubmit() {
    if (!log) return;
    if (lineItems.length === 0) {
      toast.error('Agrega al menos un servicio');
      return;
    }
    const missingVariant = lineItems.find(
      (it) => Array.isArray(it.availableVariants) && it.availableVariants.length > 0 && !it.variantId
    );
    if (missingVariant) {
      toast.error(`Elige la variante para "${missingVariant.serviceName}"`);
      return;
    }
    if (isPaid && paymentMethod === 'transfer' && !paymentBank) {
      toast.error('Selecciona el banco emisor');
      return;
    }

    const patchLog = updateLog.mutateAsync({
      id: log.id,
      data: {
        attendedBy,
        paymentMethod: isPaid ? paymentMethod : undefined,
        paymentBank: isPaid && paymentMethod === 'transfer' ? paymentBank : null,
        notes: notes || undefined,
      },
    });

    const patchItems = updateItems.mutateAsync({
      id: log.id,
      items: lineItems.map((it) => ({
        serviceId:  it.serviceId,
        variantId:  it.variantId,
        label:      it.variantLabel ? `${it.serviceName} · ${it.variantLabel}` : it.serviceName,
        qty:        it.qty,
        unitPrice:  it.unitPrice,
      })),
    });

    Promise.all([patchLog, patchItems]).then(() => {
      toast.success('Registro actualizado');
      onClose();
    }).catch(() => {
      toast.error('Error al actualizar');
    });
  }

  const isPending = updateLog.isPending || updateItems.isPending;
  const canSubmit = !!attendedBy && lineItems.length > 0 &&
    lineItems.every(
      (it) => !Array.isArray(it.availableVariants) || it.availableVariants.length === 0 || !!it.variantId
    );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar registro</DialogTitle>
          <DialogDescription>Modifica servicios, empleado y método de pago.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-1">

          {/* ── Services ───────────────────────────────────────────── */}
          <div>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <Label>
                Servicios{' '}
                {lineItems.length > 0 && (
                  <span className="text-[12px] font-normal text-[var(--fg-muted)]">
                    ({lineItems.length})
                  </span>
                )}
              </Label>
              {lineItems.length > 0 && (
                <span
                  className="font-mono text-[13.5px] font-semibold tabular-nums text-[var(--fg-strong)]"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(total)}
                </span>
              )}
            </div>

            <ServiceCombobox
              services={services}
              selected={null}
              recentIds={[]}
              isLoading={servicesLoading}
              onSelect={handleAddLineItem}
              placeholder={lineItems.length === 0 ? 'Selecciona un servicio…' : 'Agregar otro servicio…'}
            />

            {lineItems.length > 0 && (
              <ul className="mt-2 space-y-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-2">
                {lineItems.map((it) => {
                  const variantsAvailable = Array.isArray(it.availableVariants) ? it.availableVariants : null;
                  const needsVariantPick = variantsAvailable && variantsAvailable.length > 0 && !it.variantId;
                  return (
                    <li
                      key={it.serviceId}
                      className={cn('rounded-md px-2 py-1.5', needsVariantPick && 'bg-[var(--warning-50)]')}
                    >
                      <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-[var(--fg-strong)]">
                            {it.serviceName}
                          </p>
                          {it.variantLabel && (
                            <p className="mt-0.5 truncate text-[11.5px] text-[var(--fg-muted)]">
                              {it.variantLabel}
                            </p>
                          )}
                        </div>
                        <Input
                          type="number"
                          min={1}
                          step="1"
                          value={it.qty}
                          onChange={(e) =>
                            handleUpdateLineItem(it.serviceId, {
                              qty: Math.max(1, Number(e.target.value) || 1),
                            })
                          }
                          className="h-8 w-16 text-center"
                          aria-label="Cantidad"
                        />
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={it.unitPrice}
                          onChange={(e) =>
                            handleUpdateLineItem(it.serviceId, {
                              unitPrice: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          className="h-8 w-24 text-right font-mono tabular-nums"
                          style={{ fontFamily: 'var(--font-mono)' }}
                          aria-label="Precio unitario"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveLineItem(it.serviceId)}
                          className="rounded-md p-1.5 text-[var(--fg-muted)] transition-colors hover:bg-[var(--danger-50)] hover:text-[var(--danger-600)] cursor-pointer"
                          aria-label={`Quitar ${it.serviceName}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {needsVariantPick && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--warning-700)]">
                            Elige variante:
                          </span>
                          {variantsAvailable.map((v) => (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => handlePickVariant(it.serviceId, v)}
                              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-[11.5px] font-medium text-[var(--fg-strong)] transition-colors hover:border-[var(--brand-500)] hover:bg-[var(--brand-50)] cursor-pointer"
                            >
                              <span>{v.label}</span>
                              <span
                                className="font-mono text-[11px] tabular-nums text-[var(--fg-secondary)]"
                                style={{ fontFamily: 'var(--font-mono)' }}
                              >
                                {new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(v.price)}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* ── Employee ───────────────────────────────────────────── */}
          <div>
            <Label className="mb-1.5 block">Empleado</Label>
            <Select value={attendedBy} onValueChange={setAttendedBy}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar empleado" />
              </SelectTrigger>
              <SelectContent>
                {team.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ── Payment method (only when already paid) ────────────── */}
          {isPaid && (
            <div>
              <Label className="mb-2 block">Método de pago</Label>
              <div className="grid grid-cols-4 gap-2">
                {METHODS.map((opt) => {
                  const Icon = opt.icon;
                  const active = paymentMethod === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPaymentMethod(opt.value)}
                      className={cn(
                        'flex flex-col items-center gap-1.5 rounded-lg border p-3 text-sm transition-colors cursor-pointer',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-300)]',
                        active
                          ? 'border-[var(--brand-500)] bg-[var(--brand-50)] text-[var(--brand-700)]'
                          : 'border-[var(--border)] text-[var(--fg-strong)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-sunken)]',
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      <span className="text-xs font-medium">{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              {paymentMethod === 'transfer' && (
                <div className="mt-3 space-y-2 rounded-lg border border-[var(--border)] bg-[var(--bg-app)] p-3">
                  <Label className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
                    Banco emisor
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {ECUADOR_BANKS.map((b) => {
                      const active = paymentBank === b.slug;
                      return (
                        <button
                          key={b.slug}
                          type="button"
                          onClick={() => setPaymentBank(b.slug)}
                          className={cn(
                            'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors cursor-pointer',
                            active
                              ? 'border-[var(--brand-500)] bg-[var(--brand-50)]'
                              : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]',
                          )}
                        >
                          <BankChip bank={b} size={24} />
                          <span className="min-w-0 truncate text-[12px] font-medium text-[var(--fg-strong)]">
                            {b.name.replace(/^Banco\s/, '').replace(/^Cooperativa\s/, '')}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Notes ─────────────────────────────────────────────── */}
          <div>
            <Label className="mb-1.5 block">Notas (opcional)</Label>
            <Textarea
              placeholder="Observaciones..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || isPending}>
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/admin-v2
npx tsc --noEmit 2>&1 | grep -E "error TS"
```

Expected: no output

- [ ] **Step 3: Commit**

```bash
git add apps/admin-v2/src/presentation/components/features/service-logs/edit-service-log-dialog.tsx
git commit -m "feat(admin): expand EditServiceLogDialog with service item editor"
```

---

## Self-Review

**Spec coverage:**
- ✅ Add services to existing log — `ServiceCombobox` in dialog
- ✅ Remove services — X button per line item
- ✅ Reprice services — `unitPrice` input per line item
- ✅ Change qty — `qty` input per line item
- ✅ Backend replaces items atomically — delete + re-insert in `updateItems()`
- ✅ Parent log `service_id` + `price_charged` stay consistent — re-derived after item replacement
- ✅ Variant picker still shown when auto-suggest missing — `needsVariantPick` block
- ✅ Employee + payment method + notes still editable — separate PATCH call in parallel

**Placeholder scan:** None found.

**Type consistency:**
- `ServiceLogItemDraft.serviceId` → used as `service_id` in API repo ✅
- `LineItem.serviceId` in dialog matches `ServiceLogItemDraft.serviceId` in hook ✅
- `useUpdateServiceLogItems` mutation arg `{ id, items }` matches hook signature ✅
