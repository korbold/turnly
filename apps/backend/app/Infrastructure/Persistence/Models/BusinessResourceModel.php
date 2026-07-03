<?php

namespace App\Infrastructure\Persistence\Models;

use App\Infrastructure\Persistence\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use App\Infrastructure\Persistence\Models\UserModel;

class BusinessResourceModel extends Model
{
    use HasUuids, BelongsToTenant;

    protected $table = 'business_resources';

    protected $fillable = [
        'tenant_id', 'name', 'description', 'employee_id',
        'type', 'is_active', 'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'is_active'  => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function employee()
    {
        return $this->belongsTo(UserModel::class, 'employee_id');
    }
}
