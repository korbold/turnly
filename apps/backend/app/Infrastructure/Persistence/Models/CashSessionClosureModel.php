<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Models;

use App\Infrastructure\Persistence\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Un arqueo firmado. Si la caja se reabre, este queda igual y el siguiente
 * cierre escribe otra fila: la historia de la caja es la lista completa, no
 * la última versión.
 */
class CashSessionClosureModel extends Model
{
    use HasUuids, BelongsToTenant;

    protected $table = 'cash_session_closures';

    protected $fillable = [
        'tenant_id', 'cash_session_id',
        'counted_amount', 'expected_amount', 'difference',
        'closed_by', 'closed_at', 'notes',
        'reopened_by', 'reopened_at', 'reopen_reason',
    ];

    protected function casts(): array
    {
        return [
            'counted_amount'  => 'decimal:2',
            'expected_amount' => 'decimal:2',
            'difference'      => 'decimal:2',
            'closed_at'       => 'datetime',
            'reopened_at'     => 'datetime',
        ];
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(CashSessionModel::class, 'cash_session_id');
    }

    public function closer(): BelongsTo
    {
        return $this->belongsTo(UserModel::class, 'closed_by');
    }

    public function reopener(): BelongsTo
    {
        return $this->belongsTo(UserModel::class, 'reopened_by');
    }
}
