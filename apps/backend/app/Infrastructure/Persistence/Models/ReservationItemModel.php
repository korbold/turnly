<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Models;

use App\Infrastructure\Persistence\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReservationItemModel extends Model
{
    use HasUuids, BelongsToTenant;

    protected $table = 'reservation_items';

    public const TYPE_SERVICE_VARIANT = 'service_variant';
    public const TYPE_PRODUCT = 'product';

    protected $fillable = [
        'tenant_id', 'reservation_id', 'item_type', 'ref_id',
        'label', 'qty', 'unit_price', 'line_total', 'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'qty'        => 'decimal:3',
            'unit_price' => 'decimal:2',
            'line_total' => 'decimal:2',
            'sort_order' => 'integer',
        ];
    }

    public function reservation(): BelongsTo
    {
        return $this->belongsTo(ReservationModel::class, 'reservation_id');
    }

    public function variant()
    {
        // Polymorphic — only meaningful when item_type='service_variant'.
        return $this->belongsTo(ServiceVariantModel::class, 'ref_id');
    }

    public function product()
    {
        return $this->belongsTo(ProductModel::class, 'ref_id');
    }
}
