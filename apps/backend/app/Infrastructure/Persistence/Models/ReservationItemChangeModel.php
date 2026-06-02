<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Models;

use App\Infrastructure\Persistence\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReservationItemChangeModel extends Model
{
    use HasUuids, BelongsToTenant;

    protected $table = 'reservation_item_changes';

    // Append-only audit row.
    public const UPDATED_AT = null;
    public $timestamps = false;

    public const ACTION_ADDED         = 'added';
    public const ACTION_REMOVED       = 'removed';
    public const ACTION_UPGRADED      = 'upgraded';
    public const ACTION_DOWNGRADED    = 'downgraded';
    public const ACTION_PRICE_OVERRIDE = 'price_override';

    protected $fillable = [
        'tenant_id', 'reservation_id', 'action', 'item_type',
        'old_ref_id', 'new_ref_id', 'label',
        'old_price', 'new_price', 'reason',
        'changed_by_user_id', 'changed_at',
    ];

    protected function casts(): array
    {
        return [
            'old_price'  => 'decimal:2',
            'new_price'  => 'decimal:2',
            'changed_at' => 'datetime',
        ];
    }

    public function reservation(): BelongsTo
    {
        return $this->belongsTo(ReservationModel::class, 'reservation_id');
    }

    public function changedBy(): BelongsTo
    {
        return $this->belongsTo(UserModel::class, 'changed_by_user_id');
    }
}
