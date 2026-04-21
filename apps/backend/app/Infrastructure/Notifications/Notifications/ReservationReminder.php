<?php

namespace App\Infrastructure\Notifications\Notifications;

use App\Infrastructure\Notifications\Channels\FcmChannel;
use App\Infrastructure\Persistence\Models\ReservationModel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class ReservationReminder extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private ReservationModel $reservation,
        private string $reminderType,
        private string $recipientRole,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database', FcmChannel::class];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => $this->title(),
            'body' => $this->body(),
            'action_type' => 'reservation_detail',
            'action_id' => $this->reservation->id,
            'tenant_id' => $this->reservation->tenant_id,
            'tenant_name' => $this->reservation->tenant->name ?? '',
            'icon' => 'notifications_active',
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

    private function title(): string
    {
        if ($this->reminderType === 'day_before') {
            return $this->recipientRole === 'client' ? '🔔 Recordatorio de cita' : '🔔 Cita mañana';
        }

        return $this->recipientRole === 'client' ? '⏰ Tu cita es pronto' : '⏰ Cita próxima';
    }

    private function body(): string
    {
        $service = $this->reservation->service->name;
        $time = $this->reservation->scheduled_at->format('H:i');
        $tenant = $this->reservation->tenant->name ?? '';
        $client = $this->reservation->client->name ?? '';

        if ($this->reminderType === 'day_before') {
            return $this->recipientRole === 'client'
                ? "Mañana tienes {$service} a las {$time} en {$tenant}"
                : "Mañana: {$service} con {$client} a las {$time}";
        }

        return $this->recipientRole === 'client'
            ? "En 2 horas tienes {$service} en {$tenant}"
            : "En 2 horas: {$service} con {$client}";
    }
}
