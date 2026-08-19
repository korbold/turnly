<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Models;

use App\Infrastructure\Persistence\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Una deuda que no nació de un servicio del sistema: la libreta del dueño.
 * Se salda con el mismo reparto que un servicio impago, porque
 * `payment_allocations` es polimórfica.
 */
class ManualDebtModel extends Model
{
    use HasUuids, BelongsToTenant;

    protected $table = 'manual_debts';

    protected $fillable = [
        'tenant_id', 'client_resource_id', 'client_id',
        'amount', 'reason', 'incurred_on', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'amount'      => 'decimal:2',
            'incurred_on' => 'date',
        ];
    }

    public function resource(): BelongsTo
    {
        return $this->belongsTo(ClientResourceModel::class, 'client_resource_id');
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(UserModel::class, 'client_id');
    }
}
