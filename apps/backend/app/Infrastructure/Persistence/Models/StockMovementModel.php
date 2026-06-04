<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Models;

use App\Infrastructure\Persistence\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockMovementModel extends Model
{
    use HasUuids, BelongsToTenant;

    protected $table = 'stock_movements';

    // ledger is append-only; updated_at not tracked
    public const UPDATED_AT = null;

    protected $fillable = [
        'tenant_id', 'product_id', 'type', 'qty', 'unit_cost',
        'ref_type', 'ref_id', 'user_id', 'note',
    ];

    protected function casts(): array
    {
        return [
            'qty'        => 'decimal:3',
            'unit_cost'  => 'decimal:4',
            'created_at' => 'datetime',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(ProductModel::class, 'product_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(UserModel::class, 'user_id');
    }
}
