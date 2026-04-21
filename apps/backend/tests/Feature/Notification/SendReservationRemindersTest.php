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
        'created_by' => test()->client->id,
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
