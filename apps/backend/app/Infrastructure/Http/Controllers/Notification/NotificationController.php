<?php

namespace App\Infrastructure\Http\Controllers\Notification;

use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Http\Resources\NotificationResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = $user->notifications();

        if ($request->has('unread') && $request->boolean('unread')) {
            $query = $user->unreadNotifications();
        }

        $notifications = $query->orderByDesc('created_at')->paginate(20);

        return NotificationResource::collection($notifications)
            ->additional([
                'meta' => [
                    'unread_count' => $user->unreadNotifications()->count(),
                    'timestamp' => now()->toIso8601String(),
                ],
            ])
            ->response();
    }

    public function markAsRead(Request $request, string $id): JsonResponse
    {
        $notification = $request->user()->notifications()->findOrFail($id);
        $notification->markAsRead();

        return response()->json([
            'data' => ['message' => 'Notification marked as read'],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }

    public function markAllAsRead(Request $request): JsonResponse
    {
        $request->user()->unreadNotifications->markAsRead();

        return response()->json([
            'data' => ['message' => 'All notifications marked as read'],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }
}
