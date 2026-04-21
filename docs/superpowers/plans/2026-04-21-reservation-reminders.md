# Reservation Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send automated push notification reminders to clients and assigned employees before confirmed reservations (day before at 19:00, and 2 hours before).

**Architecture:** Laravel artisan command `reservations:send-reminders` runs every minute via scheduler. Queries confirmed reservations in reminder windows, sends `ReservationReminder` notification (database + FCM), tracks sent reminders in `reservation_reminders` table to prevent duplicates.

**Tech Stack:** Laravel 13, Pest (testing), MySQL, FCM via existing `FcmChannel`

**Spec:** `docs/superpowers/specs/2026-04-21-reservation-reminders-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `database/migrations/2026_04_21_200000_create_reservation_reminders_table.php` | Create | Migration for tracking table |
| `app/Infrastructure/Persistence/Models/ReservationReminderModel.php` | Create | Eloquent model |
| `app/Infrastructure/Notifications/Notifications/ReservationReminder.php` | Create | Notification class (database + FCM) |
| `app/Infrastructure/Console/Commands/SendReservationReminders.php` | Create | Artisan command |
| `routes/console.php` | Modify | Register schedule |
| `tests/Feature/Notification/SendReservationRemindersTest.php` | Create | Command tests |

All paths relative to `apps/backend/`.

---

### Task 1: Migration and Model

**Files:**
- Create: `apps/backend/database/migrations/2026_04_21_200000_create_reservation_reminders_table.php`
- Create: `apps/backend/app/Infrastructure/Persistence/Models/ReservationReminderModel.php`

- [ ] **Step 1: Create migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reservation_reminders', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('reservation_id');
            $table->enum('type', ['day_before', 'hours_before']);
            $table->timestamp('sent_at');
            $table->timestamp('created_at')->nullable();

            $table->unique(['reservation_id', 'type']);
            $table->foreign('reservation_id')
                ->references('id')
                ->on('reservations')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reservation_reminders');
    }
};
```

- [ ] **Step 2: Create model**

```php
<?php

namespace App\Infrastructure\Persistence\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class ReservationReminderModel extends Model
{
    use HasUuids;

    protected $table = 'reservation_reminders';

    public $timestamps = false;

    protected $fillable = [
        'reservation_id',
        'type',
        'sent_at',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'sent_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    public function reservation()
    {
        return $this->belongsTo(ReservationModel::class, 'reservation_id');
    }
}
```

- [ ] **Step 3: Run migration**

Run: `cd apps/backend && php artisan migrate`
Expected: `DONE` message, `reservation_reminders` table created.

- [ ] **Step 4: Verify migration**

Run: `cd apps/backend && php artisan tinker --execute="echo Schema::hasTable('reservation_reminders') ? 'OK' : 'FAIL';"`
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add apps/backend/database/migrations/2026_04_21_200000_create_reservation_reminders_table.php apps/backend/app/Infrastructure/Persistence/Models/ReservationReminderModel.php
git commit -m "feat(reminders): add reservation_reminders table and model"
```

---

### Task 2: Notification Class

**Files:**
- Create: `apps/backend/app/Infrastructure/Notifications/Notifications/ReservationReminder.php`

- [ ] **Step 1: Create notification class**

```php
<?php

namespace App\Infrastructure\Notifications\Notifications;

use App\Infrastructure\Notifications\Channels\FcmChannel;
use App\Infrastructure\Persistence\Models\ReservationModel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class ReservationReminder extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private ReservationModel $reservation,
        private string $reminderType,
        private string $recipientRole,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database', FcmChannel::class];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => $this->title(),
            'body' => $this->body(),
            'action_type' => 'reservation_detail',
            'action_id' => $this->reservation->id,
            'tenant_id' => $this->reservation->tenant_id,
            'tenant_name' => $this->reservation->tenant->name ?? '',
            'icon' => 'notifications_active',
        ];
    }

    public function toFcm(object $notifiable): array
    {
        $data = $this->toArray($notifiable);

        return [
            'notification' => [
                'title' => $data['title'],
                'body' => $data['body'],
            ],
            'data' => $data,
        ];
    }

    private function title(): string
    {
        if ($this->reminderType === 'day_before') {
            return $this->recipientRole === 'client' ? 'Recordatorio de cita' : 'Cita mañana';
        }

        return $this->recipientRole === 'client' ? 'Tu cita es pronto' : 'Cita próxima';
    }

    private function body(): string
    {
        $service = $this->reservation->service->name;
        $time = $this->reservation->scheduled_at->format('H:i');
        $tenant = $this->reservation->tenant->name ?? '';
        $client = $this->reservation->client->name ?? '';

        if ($this->reminderType === 'day_before') {
            return $this->recipientRole === 'client'
                ? "Mañana tienes {$service} a las {$time} en {$tenant}"
                : "Mañana: {$service} con {$client} a las {$time}";
        }

        return $this->recipientRole === 'client'
            ? "En 2 horas tienes {$service} en {$tenant}"
            : "En 2 horas: {$service} con {$client}";
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/app/Infrastructure/Notifications/Notifications/ReservationReminder.php
git commit -m "feat(reminders): add ReservationReminder notification class"
```

---

### Task 3: Artisan Command

**Files:**
- Create: `apps/backend/app/Infrastructure/Console/Commands/SendReservationReminders.php`

- [ ] **Step 1: Create command**

```php
<?php

namespace App\Infrastructure\Console\Commands;

use App\Infrastructure\Notifications\Notifications\ReservationReminder;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\ReservationReminderModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;

class SendReservationReminders extends Command
{
    protected $signature = 'reservations:send-reminders';

    protected $description = 'Send push notification reminders for upcoming confirmed reservations';

    public function handle(): int
    {
        $now = Carbon::now();
        $sent = 0;

        $sent += $this->sendDayBeforeReminders($now);
        $sent += $this->sendHoursBeforeReminders($now);

        if ($sent > 0) {
            $this->info("Sent {$sent} reminder(s).");
        }

        return self::SUCCESS;
    }

    private function sendDayBeforeReminders(Carbon $now): int
    {
        if ($now->hour !== 19) {
            return 0;
        }

        $tomorrow = $now->copy()->addDay()->startOfDay();
        $tomorrowEnd = $tomorrow->copy()->endOfDay();

        $reservations = ReservationModel::withoutGlobalScopes()
            ->with(['service', 'client', 'tenant', 'assignedEmployee'])
            ->where('status', 'confirmed')
            ->whereBetween('scheduled_at', [$tomorrow, $tomorrowEnd])
            ->whereDoesntHave('reminders', fn ($q) => $q->where('type', 'day_before'))
            ->get();

        return $this->sendReminders($reservations, 'day_before');
    }

    private function sendHoursBeforeReminders(Carbon $now): int
    {
        $windowStart = $now->copy()->addMinutes(115);
        $windowEnd = $now->copy()->addMinutes(125);

        $reservations = ReservationModel::withoutGlobalScopes()
            ->with(['service', 'client', 'tenant', 'assignedEmployee'])
            ->where('status', 'confirmed')
            ->whereBetween('scheduled_at', [$windowStart, $windowEnd])
            ->whereDoesntHave('reminders', fn ($q) => $q->where('type', 'hours_before'))
            ->get();

        return $this->sendReminders($reservations, 'hours_before');
    }

    private function sendReminders($reservations, string $type): int
    {
        $sent = 0;

        foreach ($reservations as $reservation) {
            try {
                // Notify client
                $client = UserModel::find($reservation->client_id);
                if ($client) {
                    $client->notify(new ReservationReminder($reservation, $type, 'client'));
                }

                // Notify assigned employee
                if ($reservation->assigned_to) {
                    $employee = UserModel::find($reservation->assigned_to);
                    if ($employee) {
                        $employee->notify(new ReservationReminder($reservation, $type, 'employee'));
                    }
                }

                ReservationReminderModel::create([
                    'reservation_id' => $reservation->id,
                    'type' => $type,
                    'sent_at' => now(),
                    'created_at' => now(),
                ]);

                $sent++;
            } catch (\Throwable $e) {
                Log::error('Failed to send reservation reminder', [
                    'reservation_id' => $reservation->id,
                    'type' => $type,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return $sent;
    }
}
```

- [ ] **Step 2: Add `reminders` relationship to ReservationModel**

In `apps/backend/app/Infrastructure/Persistence/Models/ReservationModel.php`, add after the `serviceLog()` method:

```php
public function reminders()
{
    return $this->hasMany(ReservationReminderModel::class, 'reservation_id');
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/app/Infrastructure/Console/Commands/SendReservationReminders.php apps/backend/app/Infrastructure/Persistence/Models/ReservationModel.php
git commit -m "feat(reminders): add SendReservationReminders artisan command"
```

---

### Task 4: Register Schedule

**Files:**
- Modify: `apps/backend/routes/console.php`

- [ ] **Step 1: Add schedule registration**

Replace entire `routes/console.php` with:

```php
<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('reservations:send-reminders')->everyMinute();
```

- [ ] **Step 2: Verify command is registered**

Run: `cd apps/backend && php artisan list | grep reminders`
Expected: `reservations:send-reminders`

- [ ] **Step 3: Verify schedule is registered**

Run: `cd apps/backend && php artisan schedule:list`
Expected: Shows `reservations:send-reminders` running every minute.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/routes/console.php
git commit -m "feat(reminders): register send-reminders in scheduler"
```

---

### Task 5: Tests

**Files:**
- Create: `apps/backend/tests/Feature/Notification/SendReservationRemindersTest.php`

- [ ] **Step 1: Create test file**

```php
<?php

use App\Infrastructure\Notifications\Notifications\ReservationReminder;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Persistence\Models\ReservationReminderModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;
use App\Infrastructure\Persistence\Models\AvailabilitySlotModel;
use Illuminate\Support\Facades\Notification;

beforeEach(function () {
    Notification::fake();

    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    $this->client = UserModel::factory()->create();
    $this->employee = UserModel::factory()->create();
    $this->service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->clientResource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $this->client->id,
        'type' => 'sedan',
    ]);

    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    for ($day = 0; $day <= 6; $day++) {
        AvailabilitySlotModel::create([
            'tenant_id' => $this->tenant->id,
            'day_of_week' => $day,
            'start_time' => '00:00:00',
            'end_time' => '23:59:00',
            'max_concurrent' => 10,
            'is_active' => true,
        ]);
    }
});

function createConfirmedReservation(array $overrides = []): ReservationModel
{
    return ReservationModel::create(array_merge([
        'tenant_id' => test()->tenant->id,
        'client_id' => test()->client->id,
        'client_resource_id' => test()->clientResource->id,
        'service_id' => test()->service->id,
        'assigned_to' => test()->employee->id,
        'scheduled_at' => now()->addDay()->setHour(10)->setMinute(0),
        'estimated_end' => now()->addDay()->setHour(10)->setMinute(30),
        'status' => 'confirmed',
    ], $overrides));
}

test('sends day-before reminder at 19:00 for tomorrow confirmed reservations', function () {
    $reservation = createConfirmedReservation([
        'scheduled_at' => now()->addDay()->setHour(10)->setMinute(0),
        'estimated_end' => now()->addDay()->setHour(10)->setMinute(30),
    ]);

    $this->travelTo(now()->setHour(19)->setMinute(5)->setSecond(0));

    $this->artisan('reservations:send-reminders')->assertSuccessful();

    Notification::assertSentTo($this->client, ReservationReminder::class);
    Notification::assertSentTo($this->employee, ReservationReminder::class);

    $this->assertDatabaseHas('reservation_reminders', [
        'reservation_id' => $reservation->id,
        'type' => 'day_before',
    ]);
});

test('does not send day-before reminder outside 19:00 hour', function () {
    createConfirmedReservation([
        'scheduled_at' => now()->addDay()->setHour(10)->setMinute(0),
        'estimated_end' => now()->addDay()->setHour(10)->setMinute(30),
    ]);

    $this->travelTo(now()->setHour(18)->setMinute(30)->setSecond(0));

    $this->artisan('reservations:send-reminders')->assertSuccessful();

    Notification::assertNothingSent();
});

test('sends hours-before reminder 2 hours before appointment', function () {
    $scheduledAt = now()->addMinutes(120);

    $reservation = createConfirmedReservation([
        'scheduled_at' => $scheduledAt,
        'estimated_end' => $scheduledAt->copy()->addMinutes(30),
    ]);

    $this->artisan('reservations:send-reminders')->assertSuccessful();

    Notification::assertSentTo($this->client, ReservationReminder::class);
    Notification::assertSentTo($this->employee, ReservationReminder::class);

    $this->assertDatabaseHas('reservation_reminders', [
        'reservation_id' => $reservation->id,
        'type' => 'hours_before',
    ]);
});

test('does not send duplicate reminders', function () {
    $reservation = createConfirmedReservation([
        'scheduled_at' => now()->addDay()->setHour(10)->setMinute(0),
        'estimated_end' => now()->addDay()->setHour(10)->setMinute(30),
    ]);

    ReservationReminderModel::create([
        'reservation_id' => $reservation->id,
        'type' => 'day_before',
        'sent_at' => now(),
        'created_at' => now(),
    ]);

    $this->travelTo(now()->setHour(19)->setMinute(5)->setSecond(0));

    $this->artisan('reservations:send-reminders')->assertSuccessful();

    Notification::assertNothingSent();
});

test('does not send reminders for non-confirmed reservations', function () {
    createConfirmedReservation([
        'status' => 'pending',
        'scheduled_at' => now()->addDay()->setHour(10)->setMinute(0),
        'estimated_end' => now()->addDay()->setHour(10)->setMinute(30),
    ]);

    $this->travelTo(now()->setHour(19)->setMinute(5)->setSecond(0));

    $this->artisan('reservations:send-reminders')->assertSuccessful();

    Notification::assertNothingSent();
});

test('does not notify employee when none assigned', function () {
    $reservation = createConfirmedReservation([
        'assigned_to' => null,
        'scheduled_at' => now()->addDay()->setHour(10)->setMinute(0),
        'estimated_end' => now()->addDay()->setHour(10)->setMinute(30),
    ]);

    $this->travelTo(now()->setHour(19)->setMinute(5)->setSecond(0));

    $this->artisan('reservations:send-reminders')->assertSuccessful();

    Notification::assertSentTo($this->client, ReservationReminder::class);
    Notification::assertNotSentTo($this->employee, ReservationReminder::class);
});
```

- [ ] **Step 2: Run tests**

Run: `cd apps/backend && php artisan test --filter=SendReservationReminders`
Expected: All 6 tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/tests/Feature/Notification/SendReservationRemindersTest.php
git commit -m "test(reminders): add tests for SendReservationReminders command"
```

---

### Task 6: Manual Smoke Test

- [ ] **Step 1: Create a confirmed reservation for tomorrow via admin UI or tinker**

Run: `cd apps/backend && php artisan tinker`

```php
use App\Infrastructure\Persistence\Models\ReservationModel;
// Find a confirmed reservation or create test data
$r = ReservationModel::where('status', 'confirmed')->first();
echo $r ? "Found: {$r->id} at {$r->scheduled_at}" : "No confirmed reservations";
```

- [ ] **Step 2: Run command manually**

Run: `cd apps/backend && php artisan reservations:send-reminders -v`
Expected: Either sends reminders (if 19:00 hour and tomorrow reservations exist) or completes silently.

- [ ] **Step 3: Verify no errors in logs**

Run: `cd apps/backend && tail -20 storage/logs/laravel.log | grep -i reminder`
Expected: No error lines. If reminders were sent, no failure logs.

- [ ] **Step 4: Final commit with all changes**

```bash
git add -A
git commit -m "feat(reminders): reservation reminder push notifications

Automated reminders for confirmed reservations:
- Day before at 19:00 local time
- 2 hours before appointment
- Notifies client and assigned employee via database + FCM
- Idempotent: tracks sent reminders to prevent duplicates"
```
