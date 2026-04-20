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

class GoogleAuthController extends Controller
{
    public function login(GoogleLoginRequest $request): JsonResponse
    {
        $client = app(GoogleClient::class);
        $client->setClientId(config('services.google.client_id'));

        try {
            $payload = $client->verifyIdToken($request->id_token);
        } catch (\Exception $e) {
            $payload = false;
        }

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
            ]);
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        $tenantUser = TenantUserModel::where('user_id', $user->id)
            ->where('is_active', true)
            ->with('tenant')
            ->first();

        return response()->json([
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'is_super_admin' => $user->is_super_admin,
                ],
                'token' => $token,
                'tenant' => $tenantUser ? [
                    'id' => $tenantUser->tenant->id,
                    'slug' => $tenantUser->tenant->slug,
                    'name' => $tenantUser->tenant->name,
                ] : null,
            ],
        ]);
    }
}
