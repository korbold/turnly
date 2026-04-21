# Reservation Reminders — Push Notifications

## Summary

Automated push notification reminders for upcoming confirmed reservations. Reduces no-shows by reminding clients and assigned employees before appointments.

## Reminder Schedule

- **Day before** — sent at 19:00 local time the evening before the appointment
- **2 hours before** — sent 2 hours before `scheduled_at`

Only reservations with status `confirmed` receive reminders. Same-day bookings only get reminders that still apply (e.g., booked at 2pm for 5pm → gets 2h reminder at 3pm, no day-before).

## Recipients

- **Client** — the user who booked
- **Assigned employee** — the staff member assigned to the reservation (if any)
- Admins do NOT receive reminders (they see everything in dashboard)

## Approach — Laravel Scheduler

Artisan command `reservations:send-reminders` runs every minute via `schedule:run`. Each execution queries for reservations in the reminder windows, sends notifications, and records what was sent.

### Idempotency

Table `reservation_reminders` tracks sent reminders with a unique constraint on `(reservation_id, type)`. If the command runs twice in the same window, the second run finds existing records and skips.

## Data Model

### Table: `reservation_reminders`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| reservation_id | UUID | FK → reservations, cascade delete |
| type | enum | `day_before`, `hours_before` |
| sent_at | timestamp | when notification was dispatched |
| created_at | timestamp | |

- Unique index on `(reservation_id, type)`

## Command Logic

`php artisan reservations:send-reminders`

### Day-before query

Find reservations where:
- `status = confirmed`
- `scheduled_at` is tomorrow
- Current time is between 19:00–19:59
- No `reservation_reminders` row with `type = day_before`

### 2-hours-before query

Find reservations where:
- `status = confirmed`
- `scheduled_at` is between now+1h55m and now+2h05m (10-minute window for margin)
- No `reservation_reminders` row with `type = hours_before`

### Per reservation

1. Send `ReservationReminder` notification to client
2. Send `ReservationReminder` notification to assigned employee (if exists)
3. Insert `reservation_reminders` row

### Schedule registration

In `routes/console.php`:
```php
Schedule::command('reservations:send-reminders')->everyMinute();
```

## Timezone

- `APP_TIMEZONE` set to `America/Guayaquil` in production `.env`
- `scheduled_at` and `now()` both use app timezone — direct comparison
- Future: if multi-timezone tenants needed, add `timezone` to tenant `settings` JSON

## Notification Class

Single class `ReservationReminder` that receives reminder type and adjusts message text.

### Channels

`['database', FcmChannel::class]` — same as existing notifications.

### Messages

| Type | Recipient | Title | Body |
|------|-----------|-------|------|
| `day_before` | Client | Recordatorio de cita | Mañana tienes {servicio} a las {hora} en {negocio} |
| `day_before` | Employee | Cita mañana | Mañana: {servicio} con {cliente} a las {hora} |
| `hours_before` | Client | Tu cita es pronto | En 2 horas tienes {servicio} en {negocio} |
| `hours_before` | Employee | Cita próxima | En 2 horas: {servicio} con {cliente} |

### FCM Data Payload

```php
[
    'action_type' => 'reservation_detail',
    'action_id' => $reservation->id,
    'tenant_id' => $reservation->tenant_id,
    'tenant_name' => $tenant->name,
    'icon' => 'notifications_active',
]
```

Client app already navigates to reservation detail via `action_type` + `action_id`.

## New Files

| File | Purpose |
|------|---------|
| `database/migrations/xxxx_create_reservation_reminders_table.php` | Tracking table |
| `app/Infrastructure/Persistence/Models/ReservationReminderModel.php` | Eloquent model |
| `app/Infrastructure/Notifications/Notifications/ReservationReminder.php` | Notification class |
| `app/Infrastructure/Console/Commands/SendReservationReminders.php` | Artisan command |

## Modified Files

| File | Change |
|------|--------|
| `routes/console.php` | Register `everyMinute()` schedule |

## Not In Scope

- Admin notifications for reminders
- Configurable reminder times per tenant
- SMS/email reminders
- Flutter or admin-v2 changes (notifications arrive automatically)
