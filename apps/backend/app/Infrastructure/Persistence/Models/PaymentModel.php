<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Models;

use App\Infrastructure\Persistence\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Plata que entró. Ver el spec: es el cimiento de la caja del día, los abonos
 * y la deuda de clientes.
 */
class PaymentModel extends Model
{
    use HasUuids, BelongsToTenant;

    protected $table = 'payments';

    public const METHODS = ['cash', 'card', 'transfer', 'other'];

    protected $fillable = [
        'tenant_id', 'client_id', 'amount', 'method', 'bank',
        'paid_at', 'received_by', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'amount'  => 'decimal:2',
            'paid_at' => 'datetime',
        ];
    }

    public function allocations(): HasMany
    {
        return $this->hasMany(PaymentAllocationModel::class, 'payment_id');
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(UserModel::class, 'client_id');
    }

    public function receiver(): BelongsTo
    {
        return $this->belongsTo(UserModel::class, 'received_by');
    }

    /** Lo que todavía no se aplicó a nada: saldo a favor del cliente. */
    public function unallocatedAmount(): float
    {
        return (float) $this->amount - (float) $this->allocations()->sum('amount');
    }
}
