<?php

namespace App\Infrastructure\Notifications\Services;

use App\Infrastructure\Persistence\Models\DeviceTokenModel;
use Google\Client as GoogleClient;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class FcmService
{
    private ?string $accessToken = null;
    private ?int $tokenExpiresAt = null;

    public function send(string $fcmToken, array $notification, array $data = []): bool
    {
        $projectId = config('services.firebase.project_id');
        $url = "https://fcm.googleapis.com/v1/projects/{$projectId}/messages:send";

        $message = [
            'message' => [
                'token' => $fcmToken,
                'notification' => [
                    'title' => $notification['title'],
                    'body' => $notification['body'],
                ],
                'data' => array_map('strval', $data),
                'webpush' => $this->buildWebPushConfig($data),
                'android' => [
                    'priority' => 'HIGH',
                    'notification' => ['default_sound' => true],
                ],
                'apns' => [
                    'headers' => ['apns-priority' => '10'],
                    'payload' => ['aps' => ['sound' => 'default']],
                ],
            ],
        ];

        $response = Http::withToken($this->getAccessToken())
            ->post($url, $message);

        if ($response->successful()) {
            return true;
        }

        $status = $response->status();
        $error = $response->json('error.details.0.errorCode') ?? $response->json('error.status') ?? '';

        // Token is invalid or unregistered — deactivate it
        if ($status === 404 || $status === 410 || $error === 'UNREGISTERED') {
            DeviceTokenModel::where('token', $fcmToken)->update(['is_active' => false]);
            Log::info("FCM: deactivated invalid token", ['token' => substr($fcmToken, 0, 20) . '...']);
            return false;
        }

        Log::warning("FCM: send failed", [
            'status' => $status,
            'error' => $response->json('error'),
        ]);

        return false;
    }

    public function sendToMany(array $fcmTokens, array $notification, array $data = []): void
    {
        foreach ($fcmTokens as $token) {
            $this->send($token, $notification, $data);
        }
    }

    private function buildWebPushConfig(array $data): array
    {
        $base = rtrim(config('services.firebase.admin_url'), '/');
        $link = $base . '/dashboard';

        if (($data['action_type'] ?? null) === 'reservation_detail') {
            $link = $base . '/reservations';
        }

        return [
            'headers' => [
                'Urgency' => 'high',
                'TTL' => '86400',
            ],
            'notification' => [
                'icon' => $base . '/icons/icon-192.png',
                'badge' => $base . '/icons/icon-192.png',
                'requireInteraction' => false,
            ],
            'fcm_options' => [
                'link' => $link,
            ],
        ];
    }

    private function getAccessToken(): string
    {
        if ($this->accessToken && $this->tokenExpiresAt && time() < $this->tokenExpiresAt - 60) {
            return $this->accessToken;
        }

        $credentialsPath = config('services.firebase.credentials');

        // Resolve relative path from base_path
        if (!str_starts_with($credentialsPath, '/')) {
            $credentialsPath = base_path($credentialsPath);
        }

        $client = new GoogleClient();
        $client->setAuthConfig($credentialsPath);
        $client->addScope('https://www.googleapis.com/auth/firebase.messaging');

        $token = $client->fetchAccessTokenWithAssertion();

        $this->accessToken = $token['access_token'];
        $this->tokenExpiresAt = time() + ($token['expires_in'] ?? 3600);

        return $this->accessToken;
    }
}
