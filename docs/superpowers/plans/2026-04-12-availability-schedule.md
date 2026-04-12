# Availability Schedule & Blocks — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add weekly schedule configuration and exceptional date/time blocks to the tenant settings page.

**Architecture:** Regular schedule stored in `tenants.settings.schedule` JSON (no new table). Exceptional blocks stored in a new `availability_blocks` table with TenantScope. Frontend adds two new sections to the existing settings page.

**Tech Stack:** Laravel 13 (migration, model, controller), Next.js 16, React Query, shadcn/ui

---

### Task 1: Create availability_blocks migration

**Files:**
- Create: `apps/backend/database/migrations/2026_04_12_200000_create_availability_blocks_table.php`

- [ ] **Step 1: Create migration**

```bash
cd /Users/korbold/Documents/Freelancer/CarWash/apps/backend
php artisan make:migration create_availability_blocks_table
```

Then replace the generated file content with:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('availability_blocks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->date('date');
            $table->time('start_time')->nullable();
            $table->time('end_time')->nullable();
            $table->string('reason', 255)->nullable();
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->index(['tenant_id', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('availability_blocks');
    }
};
```

- [ ] **Step 2: Run migration**

```bash
cd /Users/korbold/Documents/Freelancer/CarWash/apps/backend
php artisan migrate
```

- [ ] **Step 3: Commit**

```bash
cd /Users/korbold/Documents/Freelancer/CarWash
git add apps/backend/database/migrations/
git commit -m "feat: create availability_blocks table"
```

---

### Task 2: Create AvailabilityBlockModel

**Files:**
- Create: `apps/backend/app/Infrastructure/Persistence/Models/AvailabilityBlockModel.php`

- [ ] **Step 1: Create the model**

Create `apps/backend/app/Infrastructure/Persistence/Models/AvailabilityBlockModel.php`:

```php
<?php

namespace App\Infrastructure\Persistence\Models;

use App\Infrastructure\Persistence\Scopes\TenantScope;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class AvailabilityBlockModel extends Model
{
    use HasUuids;

    protected $table = 'availability_blocks';

    protected $fillable = [
        'tenant_id',
        'date',
        'start_time',
        'end_time',
        'reason',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
        ];
    }

    protected static function booted(): void
    {
        static::addGlobalScope(new TenantScope());
    }
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/korbold/Documents/Freelancer/CarWash
git add apps/backend/app/Infrastructure/Persistence/Models/AvailabilityBlockModel.php
git commit -m "feat: create AvailabilityBlockModel with TenantScope"
```

---

### Task 3: Create AvailabilityBlockController + Routes

**Files:**
- Create: `apps/backend/app/Infrastructure/Http/Controllers/AvailabilityBlockController.php`
- Modify: `apps/backend/routes/api.php`

- [ ] **Step 1: Create the controller**

Create `apps/backend/app/Infrastructure/Http/Controllers/AvailabilityBlockController.php`:

```php
<?php

namespace App\Infrastructure\Http\Controllers;

use App\Infrastructure\Persistence\Models\AvailabilityBlockModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AvailabilityBlockController extends Controller
{
    public function index(): JsonResponse
    {
        $blocks = AvailabilityBlockModel::orderBy('date', 'desc')->get();

        return response()->json(['data' => $blocks]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'date' => 'required|date',
            'start_time' => 'nullable|date_format:H:i',
            'end_time' => 'nullable|date_format:H:i|after:start_time',
            'reason' => 'nullable|string|max:255',
        ]);

        $block = AvailabilityBlockModel::create([
            'tenant_id' => app('current_tenant_id'),
            'date' => $validated['date'],
            'start_time' => $validated['start_time'] ?? null,
            'end_time' => $validated['end_time'] ?? null,
            'reason' => $validated['reason'] ?? null,
        ]);

        return response()->json(['data' => $block], 201);
    }

    public function destroy(string $id): JsonResponse
    {
        $block = AvailabilityBlockModel::findOrFail($id);
        $block->delete();

        return response()->json(['data' => ['message' => 'Block deleted']]);
    }
}
```

- [ ] **Step 2: Add routes**

In `apps/backend/routes/api.php`, inside the `Route::middleware('tenant')->group(function () {` block, add these lines (after the existing reservation routes):

```php
    // Availability blocks
    Route::get('availability-blocks', [\App\Infrastructure\Http\Controllers\AvailabilityBlockController::class, 'index']);
    Route::post('availability-blocks', [\App\Infrastructure\Http\Controllers\AvailabilityBlockController::class, 'store']);
    Route::delete('availability-blocks/{id}', [\App\Infrastructure\Http\Controllers\AvailabilityBlockController::class, 'destroy']);
```

- [ ] **Step 3: Commit**

```bash
cd /Users/korbold/Documents/Freelancer/CarWash
git add apps/backend/app/Infrastructure/Http/Controllers/AvailabilityBlockController.php apps/backend/routes/api.php
git commit -m "feat: add AvailabilityBlockController with index/store/destroy + routes"
```

---

### Task 4: Create frontend types and API client

**Files:**
- Create: `apps/admin/src/types/availability-block.ts`
- Create: `apps/admin/src/lib/api/availability-blocks.ts`

- [ ] **Step 1: Create type**

Create `apps/admin/src/types/availability-block.ts`:

```typescript
export interface AvailabilityBlock {
  id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
  created_at: string;
}
```

- [ ] **Step 2: Create API client**

Create `apps/admin/src/lib/api/availability-blocks.ts`:

```typescript
import api from './client';
import type { AvailabilityBlock } from '@/types/availability-block';

export async function getAvailabilityBlocks(): Promise<AvailabilityBlock[]> {
  const response = await api.get('/availability-blocks');
  return response.data.data;
}

export async function createAvailabilityBlock(data: {
  date: string;
  start_time?: string | null;
  end_time?: string | null;
  reason?: string | null;
}): Promise<AvailabilityBlock> {
  const response = await api.post('/availability-blocks', data);
  return response.data.data;
}

export async function deleteAvailabilityBlock(id: string): Promise<void> {
  await api.delete(`/availability-blocks/${id}`);
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/korbold/Documents/Freelancer/CarWash
git add apps/admin/src/types/availability-block.ts apps/admin/src/lib/api/availability-blocks.ts
git commit -m "feat: add AvailabilityBlock type and API client"
```

---

### Task 5: Add schedule and blocks sections to settings page

**Files:**
- Modify: `apps/admin/src/app/(tenant)/settings/page.tsx`

This is the largest task. The settings page already has ~600 lines. We add two new Card sections.

- [ ] **Step 1: Add imports**

At the top of `apps/admin/src/app/(tenant)/settings/page.tsx`, add these imports after the existing ones:

```typescript
import { getAvailabilityBlocks, createAvailabilityBlock, deleteAvailabilityBlock } from '@/lib/api/availability-blocks';
import type { AvailabilityBlock } from '@/types/availability-block';
```

- [ ] **Step 2: Add schedule state**

Inside the `SettingsPage` component, after the existing `const [permissions, ...]` state declarations (around line 58), add:

```typescript
  const DAYS = [
    { key: 'monday', label: 'Lunes' },
    { key: 'tuesday', label: 'Martes' },
    { key: 'wednesday', label: 'Miércoles' },
    { key: 'thursday', label: 'Jueves' },
    { key: 'friday', label: 'Viernes' },
    { key: 'saturday', label: 'Sábado' },
    { key: 'sunday', label: 'Domingo' },
  ] as const;

  type DaySchedule = { open: string | null; close: string | null; active: boolean };
  type WeekSchedule = Record<string, DaySchedule>;

  const DEFAULT_SCHEDULE: WeekSchedule = {
    monday:    { open: '08:00', close: '18:00', active: true },
    tuesday:   { open: '08:00', close: '18:00', active: true },
    wednesday: { open: '08:00', close: '18:00', active: true },
    thursday:  { open: '08:00', close: '18:00', active: true },
    friday:    { open: '08:00', close: '18:00', active: true },
    saturday:  { open: '09:00', close: '14:00', active: true },
    sunday:    { open: null, close: null, active: false },
  };

  const [schedule, setSchedule] = useState<WeekSchedule>(DEFAULT_SCHEDULE);

  // Block form state
  const [blockDate, setBlockDate] = useState('');
  const [blockStartTime, setBlockStartTime] = useState('');
  const [blockEndTime, setBlockEndTime] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [blockAllDay, setBlockAllDay] = useState(true);
```

- [ ] **Step 3: Add schedule initialization from fetched data**

In the existing `useEffect` that initializes form state from `tenantSettings` (the one with `if (!tenantSettings) return;`), add at the end before the closing `}`:

```typescript
    // Load schedule from settings
    const settingsObj = t.settings as Record<string, unknown> | null;
    if (settingsObj?.schedule) {
      setSchedule({ ...DEFAULT_SCHEDULE, ...(settingsObj.schedule as WeekSchedule) });
    }
```

- [ ] **Step 4: Update handleSave to include schedule**

In the `handleSave` function, update the `updateMutation.mutate()` call to include schedule in settings. Replace the existing `handleSave`:

```typescript
  function handleSave() {
    const currentSettings = (tenantSettings as Record<string, unknown>)?.settings as Record<string, unknown> ?? {};
    updateMutation.mutate({
      name,
      description,
      address,
      phone,
      business_type: businessType,
      brand_theme: brandTheme,
      logo_url: logoUrl || undefined,
      cover_url: coverUrl || undefined,
      social_links: socialLinks,
      custom_fields: customFields,
      settings: {
        ...currentSettings,
        schedule,
      },
    });
  }
```

- [ ] **Step 5: Add blocks query and mutations**

After the existing gallery mutations, add:

```typescript
  // Availability blocks
  const { data: blocks = [] } = useQuery({
    queryKey: ['availability-blocks'],
    queryFn: getAvailabilityBlocks,
  });

  const addBlockMutation = useMutation({
    mutationFn: createAvailabilityBlock,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability-blocks'] });
      setBlockDate('');
      setBlockStartTime('');
      setBlockEndTime('');
      setBlockReason('');
      setBlockAllDay(true);
    },
  });

  const deleteBlockMutation = useMutation({
    mutationFn: deleteAvailabilityBlock,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability-blocks'] });
    },
  });

  function handleAddBlock() {
    if (!blockDate) return;
    createAvailabilityBlock({
      date: blockDate,
      start_time: blockAllDay ? null : (blockStartTime || null),
      end_time: blockAllDay ? null : (blockEndTime || null),
      reason: blockReason || null,
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['availability-blocks'] });
      setBlockDate('');
      setBlockStartTime('');
      setBlockEndTime('');
      setBlockReason('');
      setBlockAllDay(true);
    });
  }
```

- [ ] **Step 6: Add schedule UI section**

In the JSX, after the "Redes sociales" Card (Section 3, around line 378) and before the "Galería" Card (Section 4), add:

```tsx
          {/* Section: Schedule */}
          <Card>
            <CardHeader>
              <CardTitle>Horarios de atención</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {DAYS.map((day) => {
                const daySchedule = schedule[day.key];
                return (
                  <div key={day.key} className="flex items-center gap-3">
                    <label className="flex items-center gap-2 w-28">
                      <input
                        type="checkbox"
                        checked={daySchedule.active}
                        onChange={(e) =>
                          setSchedule((prev) => ({
                            ...prev,
                            [day.key]: {
                              ...prev[day.key],
                              active: e.target.checked,
                              open: e.target.checked ? (prev[day.key].open ?? '08:00') : null,
                              close: e.target.checked ? (prev[day.key].close ?? '18:00') : null,
                            },
                          }))
                        }
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm font-medium text-[#343C6A]">{day.label}</span>
                    </label>
                    {daySchedule.active ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="time"
                          value={daySchedule.open ?? '08:00'}
                          onChange={(e) =>
                            setSchedule((prev) => ({
                              ...prev,
                              [day.key]: { ...prev[day.key], open: e.target.value },
                            }))
                          }
                          className="w-32"
                        />
                        <span className="text-sm text-[#718EBF]">a</span>
                        <Input
                          type="time"
                          value={daySchedule.close ?? '18:00'}
                          onChange={(e) =>
                            setSchedule((prev) => ({
                              ...prev,
                              [day.key]: { ...prev[day.key], close: e.target.value },
                            }))
                          }
                          className="w-32"
                        />
                      </div>
                    ) : (
                      <span className="text-sm text-[#718EBF]">Cerrado</span>
                    )}
                  </div>
                );
              })}
              <p className="text-xs text-[#718EBF] mt-2">
                Los horarios se guardan con el botón &quot;Guardar cambios&quot; al final.
              </p>
            </CardContent>
          </Card>

          {/* Section: Availability Blocks */}
          <Card>
            <CardHeader>
              <CardTitle>Bloqueos excepcionales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {blocks.length > 0 && (
                <div className="space-y-2">
                  {(blocks as AvailabilityBlock[]).map((block) => (
                    <div
                      key={block.id}
                      className="flex items-center justify-between p-3 bg-[#F5F7FA] rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-[#343C6A]">
                          {new Date(block.date).toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </span>
                        <span className="text-sm text-[#718EBF]">
                          {block.start_time && block.end_time
                            ? `${block.start_time.slice(0, 5)} - ${block.end_time.slice(0, 5)}`
                            : 'Todo el día'}
                        </span>
                        {block.reason && (
                          <span className="text-sm text-[#718EBF]">&mdash; {block.reason}</span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteBlockMutation.mutate(block.id)}
                        disabled={deleteBlockMutation.isPending}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {blocks.length === 0 && (
                <p className="text-sm text-[#718EBF] text-center py-2">
                  No hay bloqueos configurados.
                </p>
              )}

              <div className="border border-[#DFE5EE] rounded-lg p-4 space-y-3">
                <p className="text-sm font-medium text-[#343C6A]">Agregar bloqueo</p>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-[#718EBF]">Fecha</label>
                    <Input
                      type="date"
                      value={blockDate}
                      onChange={(e) => setBlockDate(e.target.value)}
                      className="w-40"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-[#343C6A] pb-2">
                    <input
                      type="checkbox"
                      checked={blockAllDay}
                      onChange={(e) => setBlockAllDay(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    Todo el día
                  </label>
                  {!blockAllDay && (
                    <>
                      <div className="space-y-1">
                        <label className="text-xs text-[#718EBF]">Desde</label>
                        <Input
                          type="time"
                          value={blockStartTime}
                          onChange={(e) => setBlockStartTime(e.target.value)}
                          className="w-32"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-[#718EBF]">Hasta</label>
                        <Input
                          type="time"
                          value={blockEndTime}
                          onChange={(e) => setBlockEndTime(e.target.value)}
                          className="w-32"
                        />
                      </div>
                    </>
                  )}
                  <div className="space-y-1 flex-1 min-w-[150px]">
                    <label className="text-xs text-[#718EBF]">Motivo (opcional)</label>
                    <Input
                      value={blockReason}
                      onChange={(e) => setBlockReason(e.target.value)}
                      placeholder="Ej: Feriado, mantenimiento..."
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={handleAddBlock}
                    disabled={!blockDate}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Agregar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
```

- [ ] **Step 7: Commit**

```bash
cd /Users/korbold/Documents/Freelancer/CarWash
git add apps/admin/src/app/\(tenant\)/settings/page.tsx
git commit -m "feat: add schedule and availability blocks sections to settings page"
```

---

### Task 6: Build verification

- [ ] **Step 1: Build frontend**

```bash
cd /Users/korbold/Documents/Freelancer/CarWash/apps/admin
npx next build
```

Expected: Build succeeds.
