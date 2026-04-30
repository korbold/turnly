<?php

declare(strict_types=1);

namespace App\Application\Services;

use App\Infrastructure\Mail\VerificationCodeMail;
use App\Infrastructure\Persistence\Models\EmailVerificationCodeModel;
use App\Infrastructure\Persistence\Models\UserModel;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

final class EmailVerificationService
{
    public const CODE_TTL_MINUTES = 15;

    public function issueAndSend(UserModel $user): EmailVerificationCodeModel
    {
        // Invalidate any prior pending codes for this user.
        EmailVerificationCodeModel::where('user_id', $user->id)
            ->whereNull('used_at')
            ->update(['used_at' => now()]);

        $record = EmailVerificationCodeModel::create([
            'id' => (string) Str::uuid(),
            'user_id' => $user->id,
            'code' => $this->generateCode(),
            'expires_at' => now()->addMinutes(self::CODE_TTL_MINUTES),
            'attempts' => 0,
        ]);

        Mail::to($user->email)->queue(new VerificationCodeMail($user, $record->code));

        return $record;
    }

    /**
     * @return array{ok:bool, reason?:string}
     */
    public function verify(UserModel $user, string $code): array
    {
        $record = EmailVerificationCodeModel::where('user_id', $user->id)
            ->whereNull('used_at')
            ->orderByDesc('created_at')
            ->first();

        if ($record === null) {
            return ['ok' => false, 'reason' => 'NO_CODE'];
        }

        if ($record->isExpired()) {
            return ['ok' => false, 'reason' => 'EXPIRED'];
        }

        if ($record->isLocked()) {
            return ['ok' => false, 'reason' => 'LOCKED'];
        }

        if (!hash_equals($record->code, $code)) {
            $record->increment('attempts');
            return ['ok' => false, 'reason' => 'INVALID'];
        }

        $record->update(['used_at' => now()]);
        $user->forceFill(['email_verified_at' => now()])->save();

        return ['ok' => true];
    }

    private function generateCode(): string
    {
        return str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    }
}
