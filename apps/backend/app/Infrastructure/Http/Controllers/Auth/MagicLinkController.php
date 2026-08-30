<?php

declare(strict_types=1);

namespace App\Infrastructure\Http\Controllers\Auth;

use App\Domain\Identity\MagicLinkIssuer;
use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Mail\MagicLinkMail;
use App\Infrastructure\Persistence\Models\TenantUserModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class MagicLinkController extends Controller
{
    public function __construct(private MagicLinkIssuer $issuer) {}

    private const TTL_MINUTES = MagicLinkIssuer::TTL_LOGIN_MINUTES;

    // Fixed bypass token for App Store review account. 64-char hex.
    private const DEMO_EMAIL = 'demo@turnly.app';
    private const DEMO_TOKEN = 'de00000000000000000000000000000000000000000000000000000000000002';

    public function request(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email|max:255',
        ]);

        $email = strtolower(trim((string) $request->input('email')));

        if ($email === self::DEMO_EMAIL) {
            return $this->handleDemoRequest();
        }

        $expiresAt = now()->addMinutes(self::TTL_MINUTES);

        $token = $this->issuer->issue(
            email: $email,
            ttlMinutes: self::TTL_MINUTES,
            requestIp: $request->ip(),
            userAgent: (string) $request->userAgent(),
        );

        $magicUrl = $this->issuer->urlFor($token);

        Mail::to($email)->send(new MagicLinkMail(
            email: $email,
            magicUrl: $magicUrl,
            ttlMinutes: self::TTL_MINUTES,
        ));

        return response()->json([
            'data' => [
                'sent_to' => $email,
                'expires_at' => $expiresAt->toIso8601String(),
            ],
        ]);
    }

    public function verify(Request $request): JsonResponse
    {
        $request->validate([
            'token' => 'required|string|size:64',
        ]);

        $token = (string) $request->input('token');
        $tokenHash = hash('sha256', $token);

        $row = DB::table('magic_link_tokens')
            ->where('token_hash', $tokenHash)
            ->first();

        if (!$row) {
            return $this->reject('INVALID_LINK', 'Link inválido o expirado.');
        }

        $isDemo = $row->email === self::DEMO_EMAIL;

        if (!$isDemo) {
            if ($row->used_at !== null) {
                return $this->reject('LINK_USED', 'Este link ya se usó. Pide uno nuevo.');
            }
            if (now()->greaterThan($row->expires_at)) {
                return $this->reject('LINK_EXPIRED', 'Link expirado. Pide uno nuevo.');
            }
            DB::table('magic_link_tokens')
                ->where('id', $row->id)
                ->update(['used_at' => now()]);
        }

        $email = $row->email;
        $user = UserModel::where('email', $email)->first();

        if (!$user) {
            $user = UserModel::create([
                'name' => Str::before($email, '@'),
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

        // Auto-restore: logging in via magic link during grace period cancels deletion.
        $accountRestored = false;
        if ($user->deletion_requested_at !== null) {
            $user->update(['deletion_requested_at' => null]);
            $accountRestored = true;
        }

        $sanctumToken = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'is_super_admin' => $user->is_super_admin,
                    'terms_accepted_at' => $user->terms_accepted_at?->toIso8601String(),
                ],
                'token' => $sanctumToken,
                'account_restored' => $accountRestored,
                'tenant' => $tenant ? [
                    'id' => $tenant->id,
                    'slug' => $tenant->slug,
                    'name' => $tenant->name,
                    'status' => $tenant->status,
                ] : null,
            ],
        ]);
    }

    private function handleDemoRequest(): JsonResponse
    {
        $tokenHash = hash('sha256', self::DEMO_TOKEN);

        DB::table('magic_link_tokens')->where('email', self::DEMO_EMAIL)->delete();
        DB::table('magic_link_tokens')->insert([
            'email' => self::DEMO_EMAIL,
            'token_hash' => $tokenHash,
            'expires_at' => now()->addYears(10),
            'request_ip' => '127.0.0.1',
            'request_user_agent' => 'demo-bypass',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'data' => [
                'sent_to' => self::DEMO_EMAIL,
                'expires_at' => now()->addYears(10)->toIso8601String(),
                'demo_token' => self::DEMO_TOKEN,
            ],
        ]);
    }

    private function reject(string $code, string $message): JsonResponse
    {
        return response()->json([
            'error' => ['code' => $code, 'message' => $message],
        ], 401);
    }
}
