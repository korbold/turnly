<?php

namespace App\Infrastructure\Http\Controllers\Notification;

use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Http\Requests\Notification\RegisterDeviceTokenRequest;
use App\Infrastructure\Persistence\Models\DeviceTokenModel;
use Illuminate\Http\JsonResponse;

class DeviceTokenController extends Controller
{
    public function store(RegisterDeviceTokenRequest $request): JsonResponse
    {
        $user = $request->user();
        $tenantId = app()->has('current_tenant_id') ? app('current_tenant_id') : null;

        DeviceTokenModel::updateOrCreate(
            ['token' => $request->token],
            [
                'user_id' => $user->id,
                'tenant_id' => $tenantId,
                'platform' => $request->platform,
                'is_active' => true,
            ],
        );

        return response()->json([
            'data' => ['message' => 'Device token registered'],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ], 201);
    }

    public function destroy(string $token): JsonResponse
    {
        DeviceTokenModel::where('token', $token)
            ->where('user_id', request()->user()->id)
            ->delete();

        return response()->json([
            'data' => ['message' => 'Device token removed'],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }
}
