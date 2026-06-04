<?php

namespace App\Infrastructure\Notifications\Notifications;

use App\Domain\Reservation\ReservationSummary;
use App\Infrastructure\Notifications\Channels\FcmChannel;
use App\Infrastructure\Persistence\Models\ReservationModel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class ReservationCompleted extends Notification implements ShouldQueue
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
            'title' => '✅ Tu cita está lista',
            'body' => 'Terminamos tu ' . ReservationSummary::servicesLabel($this->reservation) . " en {$this->reservation->tenant->name}. Puedes pasar a retirar.",
            'action_type' => 'reservation_detail',
            'action_id' => $this->reservation->id,
            'tenant_id' => $this->reservation->tenant_id,
            'tenant_name' => $this->reservation->tenant->name ?? '',
            'icon' => 'check_circle',
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
