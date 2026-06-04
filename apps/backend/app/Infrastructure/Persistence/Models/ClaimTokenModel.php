<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClaimTokenModel extends Model
{
    use HasUuids;

    protected $table = 'claim_tokens';

    public const UPDATED_AT = null;

    public const METHOD_MAGIC_LINK = 'magic_link';
    public const METHOD_QR_PIN = 'qr_pin';

    protected $fillable = [
        'user_id', 'token_hash', 'pin', 'method',
        'expires_at', 'used_at', 'created_by_user_id',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'used_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(UserModel::class, 'user_id');
    }

    public function isExpired(): bool
    {
        return now()->greaterThan($this->expires_at);
    }

    public function isUsed(): bool
    {
        return $this->used_at !== null;
    }
}
