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
