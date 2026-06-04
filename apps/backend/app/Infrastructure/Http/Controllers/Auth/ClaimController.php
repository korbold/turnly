<?php

declare(strict_types=1);

namespace App\Infrastructure\Http\Controllers\Auth;

use App\Domain\Identity\ClaimService;
use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use RuntimeException;

/**
 * Endpoints used by the customer app and by admins to coordinate the
 * account-claim handshake: look up by identifier, kick off a magic
 * link / QR-PIN, and verify the chosen token.
 *
 * No SMS provider is wired here; the magic-link variant uses the
 * existing Resend transactional setup. The QR/PIN variant prints to
 * the cashier's screen and the customer types/scans it locally.
 */
class ClaimController extends Controller
{
    public function __construct(private ClaimService $claim) {}

    /**
     * Public lookup: tells the customer signup screen whether the
     * identifier already maps to a user. Never leaks tenant info; only
     * masked email/phone and whether the account is a ghost.
     */
    public function lookup(Request $request): JsonResponse
    {
        $data = $request->validate([
            'identifier' => ['required', 'string', 'max:255'],
        ]);

        $identifier = trim($data['identifier']);
        $user = $this->findByIdentifier($identifier);

        if (!$user) {
            return response()->json([
                'data' => [
                    'exists' => false,
                ],
            ]);
        }

        return response()->json([
            'data' => [
                'exists' => true,
                'is_ghost' => $user->isGhost(),
                'masked_email' => $user->email ? $this->maskEmail($user->email) : null,
                'masked_phone' => $user->phone ? $this->maskPhone($user->phone) : null,
                'has_email' => (bool) $user->email,
                'has_phone' => (bool) $user->phone,
                // Default suggestion based on what we can reach the
                // customer at without bothering them for new info.
                'recommended_method' => $user->email ? 'magic_link' : 'qr_pin',
            ],
        ]);
    }

    public function start(Request $request): JsonResponse
    {
        $data = $request->validate([
            'identifier' => ['required', 'string', 'max:255'],
            'method'     => ['required', Rule::in(['magic_link', 'qr_pin'])],
        ]);

        $user = $this->findByIdentifier($data['identifier']);
        if (!$user) {
            return response()->json([
                'error' => ['code' => 'NOT_FOUND', 'message' => 'No encontramos tu cuenta.'],
            ], 404);
        }

        try {
            if ($data['method'] === 'magic_link') {
                $this->claim->startMagicLink($user);
                return response()->json([
                    'data' => [
                        'method' => 'magic_link',
                        'message' => 'Te enviamos un link a ' . $this->maskEmail($user->email),
                    ],
                ]);
            }

            $info = $this->claim->startQrPin($user);
            return response()->json([
                'data' => array_merge($info, ['method' => 'qr_pin']),
            ]);
        } catch (RuntimeException $e) {
            return response()->json([
                'error' => ['code' => 'CANNOT_START', 'message' => $e->getMessage()],
            ], 422);
        }
    }

    public function verify(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['nullable', 'string', 'size:64'],
            'pin'   => ['nullable', 'string', 'max:8'],
        ]);

        if (empty($data['token']) && empty($data['pin'])) {
            return response()->json([
                'error' => ['code' => 'MISSING', 'message' => 'Falta el código o link.'],
            ], 422);
        }

        try {
            $user = !empty($data['token'])
                ? $this->claim->verifyByToken($data['token'])
                : $this->claim->verifyByPin($data['pin']);
        } catch (RuntimeException $e) {
            return response()->json([
                'error' => ['code' => 'INVALID', 'message' => $e->getMessage()],
            ], 401);
        }

        $sanctumToken = $user->createToken('claim')->plainTextToken;

        return response()->json([
            'data' => [
                'token' => $sanctumToken,
                'user' => [
                    'id'    => $user->id,
                    'name'  => $user->name,
                    'email' => $user->email,
                    'phone' => $user->phone,
                ],
            ],
        ]);
    }

    /** Admin endpoint: generate a QR + PIN for a specific user. */
    public function inviteToApp(Request $request, string $userId): JsonResponse
    {
        $user = UserModel::findOrFail($userId);

        $info = $this->claim->startQrPin(
            user: $user,
            cashierId: $request->user()?->id,
        );

        return response()->json([
            'data' => array_merge($info, [
                'user_id' => $user->id,
            ]),
        ]);
    }

    private function findByIdentifier(string $identifier): ?UserModel
    {
        $identifier = trim($identifier);
        if ($identifier === '') return null;

        $normalizedPhone = preg_replace('/\D+/', '', $identifier);

        return UserModel::query()
            ->leftJoin('user_billing_profiles as bp', function ($j) {
                $j->on('bp.user_id', '=', 'users.id')->where('bp.is_default', true);
            })
            ->where(function ($w) use ($identifier, $normalizedPhone) {
                $w->where('users.email', $identifier)
                    ->orWhere('users.phone', $identifier)
                    ->orWhere('users.phone', $normalizedPhone ?: 'XXX')
                    ->orWhere('users.username', $identifier)
                    ->orWhere('bp.doc_number', $identifier);
            })
            ->select('users.*')
            ->first();
    }

    private function maskEmail(string $email): string
    {
        [$local, $domain] = explode('@', $email, 2) + [null, null];
        if (!$local || !$domain) return $email;
        $visible = mb_substr($local, 0, 1);
        return $visible . str_repeat('*', max(1, mb_strlen($local) - 1)) . '@' . $domain;
    }

    private function maskPhone(string $phone): string
    {
        $digits = preg_replace('/\D+/', '', $phone);
        $len = strlen($digits);
        if ($len < 4) return $phone;
        return substr($digits, 0, 3) . str_repeat('*', $len - 6) . substr($digits, -3);
    }
}
