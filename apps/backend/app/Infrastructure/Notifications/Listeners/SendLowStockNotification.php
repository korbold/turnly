<?php

namespace App\Infrastructure\Notifications\Listeners;

use App\Events\ProductStockedLow;
use App\Infrastructure\Notifications\Notifications\LowStockForAdmin;
use App\Infrastructure\Persistence\Models\TenantModel;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;

class SendLowStockNotification implements ShouldQueue
{
    public function handle(ProductStockedLow $event): void
    {
        try {
            $tenant = TenantModel::find($event->tenantId);
            if (! $tenant) {
                return;
            }

            $admins = $tenant->users()
                ->wherePivotIn('role', ['owner', 'tenant_admin'])
                ->wherePivot('is_active', true)
                ->get();

            if ($admins->isEmpty()) {
                return;
            }

            Notification::send($admins, new LowStockForAdmin(
                tenantId:    $event->tenantId,
                tenantName:  (string) $tenant->name,
                productId:   $event->productId,
                productName: $event->productName,
                onHand:      $event->onHand,
                stockMin:    $event->stockMin,
                unit:        $event->unit,
            ));
        } catch (\Throwable $e) {
            Log::warning('low-stock notify failed', [
                'product_id' => $event->productId,
                'error'      => $e->getMessage(),
            ]);
        }
    }
}
