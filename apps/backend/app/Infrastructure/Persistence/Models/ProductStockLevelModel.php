<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductStockLevelModel extends Model
{
    protected $table = 'product_stock_levels';
    protected $primaryKey = 'product_id';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;

    protected $fillable = [
        'product_id', 'on_hand', 'reserved', 'avg_cost', 'updated_at',
    ];

    protected function casts(): array
    {
        return [
            'on_hand'    => 'decimal:3',
            'reserved'   => 'decimal:3',
            'avg_cost'   => 'decimal:4',
            'updated_at' => 'datetime',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(ProductModel::class, 'product_id');
    }
}
