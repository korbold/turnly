<?php

namespace App\Infrastructure\Notifications\Notifications;

use App\Infrastructure\Notifications\Channels\FcmChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class InvoiceAuthorized extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private string $tenantId,
        private string $tenantName,
        private string $actionType,
        private string $actionId,
        private string $numeroAutorizacion,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database', FcmChannel::class];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title'       => '✅ Factura autorizada',
            'body'        => "El SRI autorizó la factura N° {$this->numeroAutorizacion}.",
            'action_type' => $this->actionType,
            'action_id'   => $this->actionId,
            'tenant_id'   => $this->tenantId,
            'tenant_name' => $this->tenantName,
            'icon'        => 'check_circle',
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
