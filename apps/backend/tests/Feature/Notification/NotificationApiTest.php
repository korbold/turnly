<?php

use App\Infrastructure\Persistence\Models\UserModel;
use App\Infrastructure\Persistence\Models\TenantModel;
use App\Infrastructure\Persistence\Models\ServiceModel;
use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ReservationModel;
use App\Infrastructure\Notifications\Notifications\ReservationConfirmed;

test('authenticated user can list notifications', function () {
    $tenant = TenantModel::factory()->create();
    $user = UserModel::factory()->create();
    $service = ServiceModel::factory()->create(['tenant_id' => $tenant->id]);
    $clientResource = ClientResourceModel::factory()->create([
        'tenant_id' => $tenant->id,
        'client_id' => $user->id,
    ]);
    $reservation = ReservationModel::factory()->create([
        'tenant_id' => $tenant->id,
        'client_id' => $user->id,
        'client_resource_id' => $clientResource->id,
        'service_id' => $service->id,
        'created_by' => $user->id,
    ]);

    // Send notification synchronously (QUEUE_CONNECTION=sync in test)
    $user->notify(new ReservationConfirmed($reservation));

    $response = $this->actingAs($user)->getJson('/api/v1/notifications');

    $response->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonStructure([
            'data' => [['id', 'type', 'title', 'body', 'action_type', 'read_at', 'created_at']],
            'meta' => ['unread_count'],
        ]);
});

test('user can mark notification as read', function () {
    $user = UserModel::factory()->create();
    $tenant = TenantModel::factory()->create();
    $service = ServiceModel::factory()->create(['tenant_id' => $tenant->id]);
    $clientResource = ClientResourceModel::factory()->create([
        'tenant_id' => $tenant->id,
        'client_id' => $user->id,
    ]);
    $reservation = ReservationModel::factory()->create([
        'tenant_id' => $tenant->id,
        'client_id' => $user->id,
        'client_resource_id' => $clientResource->id,
        'service_id' => $service->id,
        'created_by' => $user->id,
    ]);

    $user->notify(new ReservationConfirmed($reservation));
    $notification = $user->notifications()->first();

    $response = $this->actingAs($user)->postJson("/api/v1/notifications/{$notification->id}/read");

    $response->assertOk();
    $this->assertNotNull($notification->fresh()->read_at);
});

test('user can mark all notifications as read', function () {
    $user = UserModel::factory()->create();
    $tenant = TenantModel::factory()->create();
    $service = ServiceModel::factory()->create(['tenant_id' => $tenant->id]);
    $clientResource = ClientResourceModel::factory()->create([
        'tenant_id' => $tenant->id,
        'client_id' => $user->id,
    ]);
    $reservation = ReservationModel::factory()->create([
        'tenant_id' => $tenant->id,
        'client_id' => $user->id,
        'client_resource_id' => $clientResource->id,
        'service_id' => $service->id,
        'created_by' => $user->id,
    ]);

    $user->notify(new ReservationConfirmed($reservation));
    $user->notify(new ReservationConfirmed($reservation));

    $this->actingAs($user)->postJson('/api/v1/notifications/read-all')->assertOk();

    expect($user->unreadNotifications()->count())->toBe(0);
});
