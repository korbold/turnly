<?php

declare(strict_types=1);

namespace App\Domain\Identity;

use App\Infrastructure\Mail\MagicLinkMail;
use App\Infrastructure\Persistence\Models\ClaimTokenModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Account claim flow without SMS.
 *
 *   - Magic-link: when the ghost user (or matched real user) has an
 *     email, the token rides in an email link. The customer taps the
 *     link, the app verifies, and the user's claimed_at is set.
 *   - QR + PIN: when the customer is physically at the counter, the
 *     cashier hits "Invitar a app" — we generate a short-lived PIN
 *     (and a deep-link QR carrying the same token). The customer
 *     types the PIN (or scans the QR) inside the app.
 *
 * The Sanctum login token is issued from the verify endpoint so the
 * customer is signed in immediately after claiming.
 */
final class ClaimService
{
    private const PIN_TTL_MINUTES_QR = 10;
    private const PIN_TTL_MINUTES_LINK = 15;

    public function startMagicLink(UserModel $user): ClaimTokenModel
    {
        $email = $user->email;
        if (!$email) {
            throw new RuntimeException('El usuario no tiene email para enviar el link');
        }

        // Single live token per user/method — invalidate previous ones
        // so an old email link can't be reused after a new one is sent.
        ClaimTokenModel::where('user_id', $user->id)
            ->where('method', ClaimTokenModel::METHOD_MAGIC_LINK)
            ->whereNull('used_at')
            ->update(['used_at' => now()]);

        $token = bin2hex(random_bytes(32));
        $record = ClaimTokenModel::create([
            'user_id'    => $user->id,
            'token_hash' => hash('sha256', $token),
            'method'     => ClaimTokenModel::METHOD_MAGIC_LINK,
            'pin'        => null,
            'expires_at' => now()->addMinutes(self::PIN_TTL_MINUTES_LINK),
        ]);

        $host = config('app.frontend_host', 'goturnly.com');
        $magicUrl = "https://{$host}/claim/{$token}";

        Mail::to($email)->send(new MagicLinkMail(
            email: $email,
            magicUrl: $magicUrl,
            ttlMinutes: self::PIN_TTL_MINUTES_LINK,
        ));

        return $record;
    }

    public function startQrPin(UserModel $user, ?string $cashierId = null): array
    {
        // Same single-live-token discipline as magic links.
        ClaimTokenModel::where('user_id', $user->id)
            ->where('method', ClaimTokenModel::METHOD_QR_PIN)
            ->whereNull('used_at')
            ->update(['used_at' => now()]);

        $token = bin2hex(random_bytes(32));
        $pin = $this->generatePin(6);

        $record = ClaimTokenModel::create([
            'user_id'    => $user->id,
            'token_hash' => hash('sha256', $token),
            'method'     => ClaimTokenModel::METHOD_QR_PIN,
            'pin'        => $pin,
            'expires_at' => now()->addMinutes(self::PIN_TTL_MINUTES_QR),
            'created_by_user_id' => $cashierId,
        ]);

        $host = config('app.frontend_host', 'goturnly.com');
        return [
            'token'      => $token,
            'pin'        => $pin,
            'qr_url'     => "https://{$host}/claim/{$token}",
            'expires_at' => $record->expires_at->toIso8601String(),
        ];
    }

    public function verifyByToken(string $token): UserModel
    {
        $hash = hash('sha256', $token);
        $record = ClaimTokenModel::where('token_hash', $hash)->first();
        return $this->finishClaim($record);
    }

    public function verifyByPin(string $pin): UserModel
    {
        $record = ClaimTokenModel::where('method', ClaimTokenModel::METHOD_QR_PIN)
            ->where('pin', $pin)
            ->where('expires_at', '>', now())
            ->whereNull('used_at')
            ->orderByDesc('created_at')
            ->first();
        return $this->finishClaim($record);
    }

    private function finishClaim(?ClaimTokenModel $record): UserModel
    {
        if (!$record) {
            throw new RuntimeException('Código inválido o expirado.');
        }
        if ($record->isUsed()) {
            throw new RuntimeException('Este código ya se utilizó.');
        }
        if ($record->isExpired()) {
            throw new RuntimeException('Código expirado.');
        }

        $user = UserModel::find($record->user_id);
        if (!$user) {
            throw new RuntimeException('Usuario no encontrado.');
        }

        $record->update(['used_at' => now()]);

        if ($user->claimed_at === null) {
            $user->forceFill(['claimed_at' => now()])->save();
        }

        // Email gets verified by the claim action itself: the customer
        // proved control of either the inbox (magic link) or the
        // physical store interaction (QR + PIN).
        if ($user->email && $user->email_verified_at === null) {
            $user->forceFill(['email_verified_at' => now()])->save();
        }

        return $user->fresh();
    }

    private function generatePin(int $length): string
    {
        // Avoid 0/O/1/I confusion in handwritten PINs.
        $alphabet = '23456789';
        $out = '';
        for ($i = 0; $i < $length; $i++) {
            $out .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        }
        return $out;
    }
}
