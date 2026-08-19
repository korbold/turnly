<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Models;

use App\Infrastructure\Persistence\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Qué parte de un pago cancela qué servicio. */
class PaymentAllocationModel extends Model
{
    use HasUuids, BelongsToTenant;

    protected $table = 'payment_allocations';

    public const PAYABLE_SERVICE_LOG = 'service_log';
    public const PAYABLE_RESERVATION = 'reservation';
    /** La libreta del dueño, cargada a mano. */
    public const PAYABLE_MANUAL_DEBT = 'manual_debt';

    protected $fillable = [
        'tenant_id', 'payment_id', 'payable_type', 'payable_id', 'amount',
    ];

    protected function casts(): array
    {
        return ['amount' => 'decimal:2'];
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(PaymentModel::class, 'payment_id');
    }
}
