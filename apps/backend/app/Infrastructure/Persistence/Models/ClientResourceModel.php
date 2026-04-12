<?php

namespace App\Infrastructure\Persistence\Models;

use App\Infrastructure\Persistence\Scopes\TenantScope;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ClientResourceModel extends Model
{
    use HasUuids, HasFactory, SoftDeletes;

    protected $table = 'client_resources';

    protected $fillable = [
        'tenant_id', 'client_id', 'label', 'data', 'plate', 'brand', 'model', 'color', 'type',
    ];

    protected function casts(): array
    {
        return [
            'data' => 'array',
        ];
    }

    protected static function booted(): void
    {
        static::addGlobalScope(new TenantScope());
    }

    public function client()
    {
        return $this->belongsTo(UserModel::class, 'client_id');
    }

    public function tenant()
    {
        return $this->belongsTo(TenantModel::class, 'tenant_id');
    }

    public function serviceLogs()
    {
        return $this->hasMany(ServiceLogModel::class, 'client_resource_id');
    }

    protected static function newFactory()
    {
        return \Database\Factories\ClientResourceModelFactory::new();
    }
}
