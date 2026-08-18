<?php
// apps/backend/app/Infrastructure/Persistence/Models/ServiceStaffModel.php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Models;

use App\Infrastructure\Persistence\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * Personal que ejecuta el servicio sin tener cuenta en la app.
 * Ver el spec: es lo que permite dejar `attended_by` (y su regla
 * anti-fraude) sin tocar.
 */
class ServiceStaffModel extends Model
{
    use HasUuids, BelongsToTenant;

    protected $table = 'service_staff';

    public const POSITION_WASHER = 'washer';
    public const POSITION_DRYER  = 'dryer';
    public const POSITION_BOTH   = 'both';

    public const POSITIONS = [
        self::POSITION_WASHER,
        self::POSITION_DRYER,
        self::POSITION_BOTH,
    ];

    protected $fillable = ['tenant_id', 'name', 'position', 'is_active'];

    protected $attributes = [
        'is_active' => true,
    ];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    /**
     * Los que pueden ocupar un puesto: quien lo tiene asignado, más quien
     * hace ambos. Solo activos — un select no ofrece a alguien que renunció.
     */
    public function scopeForPosition(Builder $query, string $position): Builder
    {
        return $query->where('is_active', true)
            ->whereIn('position', [$position, self::POSITION_BOTH]);
    }
}
