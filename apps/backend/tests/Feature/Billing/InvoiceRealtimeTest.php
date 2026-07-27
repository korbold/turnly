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
