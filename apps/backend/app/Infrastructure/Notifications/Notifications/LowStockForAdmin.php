<?php

namespace App\Infrastructure\Notifications\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class LowStockForAdmin extends Notification
{
    use Queueable;

    public function __construct(
        public string $tenantId,
        public string $tenantName,
        public string $productId,
        public string $productName,
        public float $onHand,
        public float $stockMin,
        public string $unit,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title'       => '⚠️ Stock bajo',
            'body'        => "{$this->productName} bajo el mínimo ({$this->onHand}/{$this->stockMin} {$this->unit}).",
            'action_type' => 'inventory',
            'action_id'   => $this->productId,
            'product_id'  => $this->productId,
            'tenant_id'   => $this->tenantId,
            'tenant_name' => $this->tenantName,
            'icon'        => 'inventory',
        ];
    }
}
