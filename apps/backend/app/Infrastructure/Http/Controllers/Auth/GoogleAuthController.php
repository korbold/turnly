<?php

namespace App\Infrastructure\Http\Controllers\Auth;

use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Http\Requests\Auth\GoogleLoginRequest;
use App\Infrastructure\Persistence\Models\UserModel;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use Google\Client as GoogleClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Hash;
use Kreait\Firebase\Factory as FirebaseFactory;
use Kreait\Firebase\Exception\Auth\FailedToVerifyToken;
use Illuminate\Support\Facades\Log;

class GoogleAuthController extends Controller
{
    public function login(GoogleLoginRequest $request): JsonResponse
    {
        $payload = $this->verifyToken($request->id_token);

        if (!$payload) {
            return response()->json([
                'error' => [
                    'code' => 'INVALID_GOOGLE_TOKEN',
                    'message' => 'Token de Google inválido.',
                ],
            ], 401);
        }

        $email = $payload['email'];
        $name = $payload['name'] ?? 'Usuario';

        $user = UserModel::where('email', $email)->first();

        if (!$user) {
            $user = UserModel::create([
                'name' => $name,
                'email' => $email,
                'password' => Hash::make(Str::random(32)),
                'email_verified_at' => now(),
            ]);
        } elseif ($user->email_verified_at === null) {
            $user->forceFill(['email_verified_at' => now()])->save();
        }

        $tenantUser = TenantUserModel::where('user_id', $user->id)
            ->where('is_active', true)
            ->with('tenant')
            ->first();

        $tenant = $tenantUser?->tenant;

        if ($tenant && $tenant->status === 'suspended' && !$user->is_super_admin) {
            return response()->json([
                'error' => [
                    'code' => 'TENANT_SUSPENDED',
                    'message' => 'Este negocio está suspendido. Contacta soporte.',
                ],
            ], 403);
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'is_super_admin' => $user->is_super_admin,
                ],
                'token' => $token,
                'tenant' => $tenant ? [
                    'id' => $tenant->id,
                    'slug' => $tenant->slug,
                    'name' => $tenant->name,
                    'status' => $tenant->status,
                ] : null,
            ],
        ]);
    }

    /**
     * Verify a Google ID token from any iOS/Android/Web OAuth client that
     * belongs to the active Firebase project. Falls back to legacy
     * Google\Client audience verification when the Firebase Admin SDK
     * isn't configured (e.g. local dev without service-account JSON).
     *
     * Returns ['email' => ..., 'name' => ...] or null on failure.
     */
    private function verifyToken(string $idToken): ?array
    {
        // Preferred path: Firebase Admin SDK accepts any Firebase-issued
        // ID token for the configured project, regardless of which OAuth
        // client (iOS / Android / Web) audience it carries.
        $credentialsPath = config('services.firebase.credentials');
        $absolutePath = $credentialsPath ? base_path($credentialsPath) : null;
        $firebaseAvailable = $absolutePath && file_exists($absolutePath);

        Log::info('[GoogleAuth] verifyToken start', [
            'firebase_available' => $firebaseAvailable,
            'credentials_path' => $credentialsPath,
        ]);

        if ($firebaseAvailable) {
            try {
                $factory = (new FirebaseFactory())
                    ->withServiceAccount($absolutePath);
                $auth = $factory->createAuth();
                $verified = $auth->verifyIdToken($idToken);
                $claims = $verified->claims()->all();
                Log::info('[GoogleAuth] firebase verify ok', [
                    'email' => $claims['email'] ?? null,
                    'aud' => $claims['aud'] ?? null,
                ]);
                return [
                    'email' => $claims['email'] ?? null,
                    'name' => $claims['name'] ?? ($claims['email'] ?? 'Usuario'),
                ];
            } catch (FailedToVerifyToken $e) {
                Log::warning('[GoogleAuth] firebase rejected token', [
                    'error' => $e->getMessage(),
                ]);
                return null;
            } catch (\Throwable $e) {
                Log::warning('[GoogleAuth] firebase verify error, falling through', [
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // Legacy path: strict Google\Client audience match.
        $client = app(GoogleClient::class);
        $client->setClientId(config('services.google.client_id'));
        try {
            $payload = $client->verifyIdToken($idToken);
        } catch (\Throwable $e) {
            Log::warning('[GoogleAuth] legacy Google\Client error', [
                'error' => $e->getMessage(),
            ]);
            return null;
        }
        if (!$payload) {
            Log::warning('[GoogleAuth] legacy Google\Client returned false', [
                'configured_client_id' => config('services.google.client_id'),
            ]);
            return null;
        }
        Log::info('[GoogleAuth] legacy verify ok');
        return [
            'email' => $payload['email'] ?? null,
            'name' => $payload['name'] ?? ($payload['email'] ?? 'Usuario'),
        ];
    }
}
