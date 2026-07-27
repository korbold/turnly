<?php

use App\Application\DTOs\Reservation\CreateReservationDTO;
use App\Application\UseCases\Reservation\CreateReservationUseCase;
use App\Events\ReservationUpdated;
use App\Infrastructure\Persistence\Models\AvailabilitySlotModel;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    $this->tenant = TenantModel::factory()->create(['status' => 'active']);
    $this->user = UserModel::factory()->create();
    $this->service = ServiceModel::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->clientResource = ClientResourceModel::factory()->create([
        'tenant_id' => $this->tenant->id,
        'client_id' => $this->user->id,
        'type' => 'sedan',
    ]);
    app()->instance('current_tenant', $this->tenant);
    app()->instance('current_tenant_id', $this->tenant->id);

    // Create availability slots for all days of the week (00:00 - 23:59)
    // so this test doesn't fail on business-hours checks.
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

test('creating a reservation broadcasts ReservationUpdated', function () {
    Event::fake([ReservationUpdated::class]);

    $scheduledAt = now()->addDay()->setHour(10)->setMinute(0)->setSecond(0);

    $useCase = app(CreateReservationUseCase::class);
    $useCase->execute(new CreateReservationDTO(
        tenantId: $this->tenant->id,
        clientId: $this->user->id,
        clientResourceId: $this->clientResource->id,
        serviceId: $this->service->id,
        scheduledAt: $scheduledAt->toIso8601String(),
        createdBy: $this->user->id,
    ));

    Event::assertDispatched(ReservationUpdated::class);
});
