<?php

namespace App\Infrastructure\Notifications\Notifications;

use App\Infrastructure\Notifications\Channels\FcmChannel;
use App\Infrastructure\Persistence\Models\ReservationModel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class NewReservationForAdmin extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private ReservationModel $reservation) {}

    public function via(object $notifiable): array
    {
        return ['database', FcmChannel::class];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => 'Nueva reserva',
            'body' => "{$this->reservation->client->name} agendó {$this->reservation->service->name} para el {$this->reservation->scheduled_at->translatedFormat('d M')} a las {$this->reservation->scheduled_at->format('H:i')}.",
            'action_type' => 'reservation_detail',
            'action_id' => $this->reservation->id,
            'tenant_id' => $this->reservation->tenant_id,
            'tenant_name' => $this->reservation->tenant->name ?? '',
            'icon' => 'calendar_today',
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
