<?php

use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('tenant.{tenantId}', function ($user, string $tenantId) {
    return $user->tenants()->where('tenants.id', $tenantId)->exists();
});

Broadcast::channel('customer.{userId}', function ($user, string $userId) {
    return (string) $user->id === $userId;
});
