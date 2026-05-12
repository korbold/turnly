<?php

namespace App\Infrastructure\Persistence\Models;

use App\Infrastructure\Persistence\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class AvailabilityBlockModel extends Model
{
    use HasUuids, BelongsToTenant;

    protected $table = 'availability_blocks';

    protected $fillable = [
        'tenant_id',
        'date',
        'start_time',
        'end_time',
        'reason',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
        ];
    }

}
