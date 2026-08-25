<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Models;

use App\Infrastructure\Persistence\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Una fila de la bitácora. Append-only: no hay update ni delete, y por eso
 * no hay updated_at.
 */
class ServiceLogEventModel extends Model
{
    use HasUuids, BelongsToTenant;

    protected $table = 'service_log_events';

    public const UPDATED_AT = null;
    public $timestamps = false;

    public const EVENT_CREATED                = 'created';
    public const EVENT_ASSIGNEE_CHANGED       = 'assignee_changed';
    /** Se le devolvió el vehículo a un servicio que lo había perdido. */
    public const EVENT_RESOURCE_ASSIGNED      = 'resource_assigned';
    public const EVENT_ITEMS_CHANGED          = 'items_changed';
    public const EVENT_LOG_UPDATED            = 'log_updated';
    public const EVENT_PAYMENT_RECORDED       = 'payment_recorded';
    /** El cobro se deshizo entero: el ticket volvió a estar por cobrar. */
    public const EVENT_PAYMENT_REVERTED       = 'payment_reverted';
    public const EVENT_STATUS_CHANGED         = 'status_changed';
    /** El registro se anuló: queda como historia, fuera de los totales. */
    public const EVENT_LOG_CANCELLED          = 'log_cancelled';
    /** Se llevó el vehículo debiendo. Es lo que separa deuda de olvido. */
    public const EVENT_LEFT_OWING             = 'left_owing';
    public const EVENT_INVOICE_REQUESTED      = 'invoice_requested';
    public const EVENT_INVOICE_STATUS_CHANGED = 'invoice_status_changed';
    /** El precio se apartó del catálogo. Con cuánto, y por qué. */
    public const EVENT_PRICE_CHANGED = 'price_changed';

    protected $fillable = [
        'tenant_id', 'service_log_id', 'event', 'detail',
        'changed_by_user_id', 'changed_at',
    ];

    protected function casts(): array
    {
        return [
            'detail'     => 'array',
            'changed_at' => 'datetime',
        ];
    }

    public function serviceLog(): BelongsTo
    {
        return $this->belongsTo(ServiceLogModel::class, 'service_log_id');
    }

    public function changedBy(): BelongsTo
    {
        return $this->belongsTo(UserModel::class, 'changed_by_user_id');
    }
}
