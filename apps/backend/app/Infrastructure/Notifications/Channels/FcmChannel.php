<?php

namespace App\Infrastructure\Notifications\Channels;

use App\Application\Services\PlanLimitsService;
use App\Infrastructure\Notifications\Services\FcmService;
use App\Infrastructure\Persistence\Models\DeviceTokenModel;
use Illuminate\Notifications\Notification;

class FcmChannel
{
    public function __construct(
        private FcmService $fcmService,
        private PlanLimitsService $planLimits,
    ) {}

    public function send(object $notifiable, Notification $notification): void
    {
        if (!method_exists($notification, 'toFcm')) {
            return;
        }

        $fcmPayload = $notification->toFcm($notifiable);
        $notificationData = $fcmPayload['notification'] ?? [];
        $data = $fcmPayload['data'] ?? [];

        $tenantId = $data['tenant_id'] ?? null;
        if ($tenantId && !$this->planLimits->hasFeature($tenantId, 'push_notifications')) {
            return;
        }

        $tokens = DeviceTokenModel::where('user_id', $notifiable->getKey())
            ->where('is_active', true)
            ->pluck('token')
            ->toArray();

        if (empty($tokens)) {
            return;
        }

        $this->fcmService->sendToMany($tokens, $notificationData, $data);
    }
}
