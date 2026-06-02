<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Models;

use App\Infrastructure\Persistence\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ServiceVariantModel extends Model
{
    use HasUuids, SoftDeletes, BelongsToTenant;

    protected $table = 'service_variants';

    protected $fillable = [
        'tenant_id', 'service_id', 'label',
        'price', 'duration_min', 'sort_order', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'price'        => 'decimal:2',
            'duration_min' => 'integer',
            'sort_order'   => 'integer',
            'is_active'    => 'boolean',
        ];
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(ServiceModel::class, 'service_id');
    }

    public function consumption(): HasMany
    {
        return $this->hasMany(ServiceVariantConsumptionModel::class, 'service_variant_id');
    }
}
