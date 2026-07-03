<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Models;

use App\Infrastructure\Persistence\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ServiceLogItemModel extends Model
{
    use HasUuids, BelongsToTenant;

    protected $table = 'service_log_items';

    protected $fillable = [
        'tenant_id', 'service_log_id', 'item_type', 'ref_id',
        'label', 'qty', 'unit_price', 'line_total', 'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'qty'        => 'decimal:2',
            'unit_price' => 'decimal:2',
            'line_total' => 'decimal:2',
            'sort_order' => 'integer',
        ];
    }

    public function serviceLog(): BelongsTo
    {
        return $this->belongsTo(ServiceLogModel::class, 'service_log_id');
    }

    /** When item_type = 'service_variant', ref_id holds the variant UUID.
        This relationship resolves the parent service so the API can expose
        service_id per item for the edit dialog. */
    public function variant(): BelongsTo
    {
        return $this->belongsTo(ServiceVariantModel::class, 'ref_id');
    }
}
