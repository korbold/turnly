<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Models;

use App\Infrastructure\Persistence\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * La caja de un día. Ver el spec: es el primer consumidor del libro de pagos
 * y la feature que prueba que el libro está bien — si el arqueo cuadra una
 * semana seguida, el cimiento es sólido.
 */
class CashSessionModel extends Model
{
    use HasUuids, BelongsToTenant;

    protected $table = 'cash_sessions';

    public const STATUS_OPEN   = 'open';
    public const STATUS_CLOSED = 'closed';

    protected $fillable = [
        'tenant_id', 'business_date',
        'opened_by', 'opened_at', 'opening_amount',
        'closed_by', 'closed_at', 'counted_amount', 'expected_amount', 'difference',
        'status', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'business_date'   => 'date',
            'opened_at'       => 'datetime',
            'closed_at'       => 'datetime',
            'opening_amount'  => 'decimal:2',
            'counted_amount'  => 'decimal:2',
            'expected_amount' => 'decimal:2',
            'difference'      => 'decimal:2',
        ];
    }

    public function scopeOpen(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_OPEN);
    }

    public function movements(): HasMany
    {
        return $this->hasMany(CashMovementModel::class, 'cash_session_id');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(PaymentModel::class, 'cash_session_id');
    }

    public function opener(): BelongsTo
    {
        return $this->belongsTo(UserModel::class, 'opened_by');
    }

    public function closer(): BelongsTo
    {
        return $this->belongsTo(UserModel::class, 'closed_by');
    }

    public function isOpen(): bool
    {
        return $this->status === self::STATUS_OPEN;
    }
}
