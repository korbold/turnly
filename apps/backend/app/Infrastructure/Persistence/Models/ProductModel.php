<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Models;

use App\Infrastructure\Persistence\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class ProductModel extends Model
{
    use HasUuids, SoftDeletes, BelongsToTenant;

    protected $table = 'products';

    protected $fillable = [
        'tenant_id', 'sku', 'name', 'description',
        'type', 'unit', 'cost', 'price', 'tax_rate',
        'stock_min', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'cost'      => 'decimal:4',
            'price'     => 'decimal:2',
            'tax_rate'  => 'decimal:2',
            'stock_min' => 'decimal:3',
            'is_active' => 'boolean',
        ];
    }

    public function movements(): HasMany
    {
        return $this->hasMany(StockMovementModel::class, 'product_id');
    }

    public function stockLevel(): HasOne
    {
        return $this->hasOne(ProductStockLevelModel::class, 'product_id');
    }
}
