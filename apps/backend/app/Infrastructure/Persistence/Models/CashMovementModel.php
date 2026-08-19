<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Models;

use App\Infrastructure\Persistence\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Plata que entra o sale del cajón sin ser un cobro. */
class CashMovementModel extends Model
{
    use HasUuids, BelongsToTenant;

    protected $table = 'cash_movements';

    /** Gasto: almuerzo, insumos. Sale del cajón y es un gasto real. */
    public const TYPE_EXPENSE = 'expense';
    /** Retiro: el dueño se lleva la recaudación. Sale, pero no es un gasto. */
    public const TYPE_WITHDRAWAL = 'withdrawal';
    /** Ingreso: reposición de cambio. Entra sin ser un cobro. */
    public const TYPE_DEPOSIT = 'deposit';

    public const TYPES = [self::TYPE_EXPENSE, self::TYPE_WITHDRAWAL, self::TYPE_DEPOSIT];

    protected $fillable = [
        'tenant_id', 'cash_session_id', 'type', 'amount', 'reason', 'created_by',
    ];

    protected function casts(): array
    {
        return ['amount' => 'decimal:2'];
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(CashSessionModel::class, 'cash_session_id');
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(UserModel::class, 'created_by');
    }
}
