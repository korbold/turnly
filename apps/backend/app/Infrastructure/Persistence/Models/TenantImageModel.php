<?php

namespace App\Infrastructure\Persistence\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class TenantImageModel extends Model
{
    use HasUuids;

    protected $table = 'tenant_images';

    protected $fillable = ['tenant_id', 'url', 'caption', 'sort_order'];

    protected function casts(): array
    {
        return ['sort_order' => 'integer'];
    }

    public function tenant()
    {
        return $this->belongsTo(TenantModel::class, 'tenant_id');
    }
}
