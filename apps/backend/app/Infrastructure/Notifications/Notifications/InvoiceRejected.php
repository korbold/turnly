<?php

namespace App\Infrastructure\Notifications\Notifications;

use App\Infrastructure\Notifications\Channels\FcmChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class InvoiceRejected extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private string $tenantId,
        private string $tenantName,
        private string $actionType,
        private string $actionId,
        private ?string $reason,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database', FcmChannel::class];
    }

    public function toArray(object $notifiable): array
    {
        $reason = $this->reason ? " Motivo: {$this->reason}" : '';

        return [
            'title'       => '❌ Factura rechazada',
            'body'        => "El SRI rechazó la factura.{$reason}",
            'action_type' => $this->actionType,
            'action_id'   => $this->actionId,
            'tenant_id'   => $this->tenantId,
            'tenant_name' => $this->tenantName,
            'icon'        => 'error',
        ];
    }

    public function toFcm(object $notifiable): array
    {
        $data = $this->toArray($notifiable);

        return [
            'notification' => ['title' => $data['title'], 'body' => $data['body']],
            'data'         => $data,
        ];
    }
}
