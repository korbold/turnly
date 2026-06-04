<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserBillingProfileModel extends Model
{
    use HasUuids;

    protected $table = 'user_billing_profiles';

    public const DOC_RUC            = 'ruc';
    public const DOC_CEDULA         = 'cedula';
    public const DOC_PASSPORT       = 'passport';
    public const DOC_FINAL_CONSUMER = 'final_consumer';

    protected $fillable = [
        'user_id', 'doc_type', 'doc_number', 'legal_name',
        'address', 'email', 'phone', 'is_default',
    ];

    protected function casts(): array
    {
        return [
            'is_default' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(UserModel::class, 'user_id');
    }
}
