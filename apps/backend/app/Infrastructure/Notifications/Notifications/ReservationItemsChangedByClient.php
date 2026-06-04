<?php

declare(strict_types=1);

namespace App\Infrastructure\Notifications\Notifications;

use App\Infrastructure\Notifications\Channels\FcmChannel;
use App\Infrastructure\Persistence\Models\ReservationModel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

/**
 * Push to tenant admins/cashiers when the customer edits items on
 * their own reservation through the Flutter app, so the counter sees
 * the new totals before the customer arrives.
 */
class ReservationItemsChangedByClient extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private ReservationModel $reservation,
        private string $action, // 'added' | 'removed'
        private string $itemLabel,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database', FcmChannel::class];
    }

    public function toArray(object $notifiable): array
    {
        $verb = $this->action === 'added' ? 'agregó' : 'quitó';
        $clientName = $this->reservation->client?->name ?? 'Un cliente';

        return [
            'title' => "✏️ {$clientName} editó su reserva",
            'body' => "{$verb} \"{$this->itemLabel}\" desde la app.",
            'action_type' => 'reservation_detail',
            'action_id' => $this->reservation->id,
            'tenant_id' => $this->reservation->tenant_id,
            'tenant_name' => $this->reservation->tenant->name ?? '',
            'icon' => 'edit_note',
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
