<?php

namespace App\Infrastructure\Notifications\Notifications;

use App\Infrastructure\Notifications\Channels\FcmChannel;
use App\Infrastructure\Persistence\Models\ReservationModel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class ReservationCancelled extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private ReservationModel $reservation,
        private string $cancelledBy = 'client',
    ) {}

    public function via(object $notifiable): array
    {
        return ['database', FcmChannel::class];
    }

    public function toArray(object $notifiable): array
    {
        $isClient = $notifiable->getKey() === $this->reservation->client_id;
        $reason = $this->reservation->cancel_reason;

        $body = $isClient
            ? "Tu reserva para {$this->reservation->service->name} el {$this->reservation->scheduled_at->translatedFormat('d M')} ha sido cancelada."
            : "La reserva de {$this->reservation->client->name} para {$this->reservation->service->name} ha sido cancelada.";

        if ($reason) {
            $body .= " Motivo: {$reason}";
        }

        return [
            'title' => '❌ Reserva cancelada',
            'body' => $body,
            'action_type' => 'reservation_detail',
            'action_id' => $this->reservation->id,
            'tenant_id' => $this->reservation->tenant_id,
            'tenant_name' => $this->reservation->tenant->name ?? '',
            'icon' => 'cancel',
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
}
