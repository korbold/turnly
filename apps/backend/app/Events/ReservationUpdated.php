<?php

namespace App\Events;

use App\Infrastructure\Persistence\Models\ReservationModel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ReservationUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public ReservationModel $reservation) {}

    public function broadcastOn(): array
    {
        $channels = [new PrivateChannel("tenant.{$this->reservation->tenant_id}")];

        if ($this->reservation->client_id) {
            $channels[] = new PrivateChannel("customer.{$this->reservation->client_id}");
        }

        return $channels;
    }

    public function broadcastAs(): string
    {
        return 'reservation.updated';
    }

    public function broadcastWith(): array
    {
        return [
            'id'             => (string) $this->reservation->id,
            'tenantId'       => (string) $this->reservation->tenant_id,
            'clientId'       => $this->reservation->client_id ? (string) $this->reservation->client_id : null,
            'status'         => (string) $this->reservation->status,
            'scheduledAt'    => optional($this->reservation->scheduled_at)?->toIso8601String(),
            'paymentStatus'  => $this->reservation->payment_status,
            'paymentMethod'  => $this->reservation->payment_method,
            'paidAt'         => optional($this->reservation->paid_at)?->toIso8601String(),
        ];
    }
}
