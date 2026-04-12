<?php

namespace App\Infrastructure\Persistence\Models;

use App\Infrastructure\Persistence\Scopes\TenantScope;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ServiceModel extends Model
{
    use HasUuids, HasFactory, SoftDeletes;

    protected $table = 'services';

    protected $fillable = [
        'tenant_id', 'name', 'description', 'price',
        'is_active', 'sort_order', 'image_url',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::addGlobalScope(new TenantScope());
    }

    public function tenant()
    {
        return $this->belongsTo(TenantModel::class, 'tenant_id');
    }

    protected static function newFactory()
    {
        return \Database\Factories\ServiceModelFactory::new();
    }
}
