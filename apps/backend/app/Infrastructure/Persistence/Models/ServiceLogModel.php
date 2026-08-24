<?php

namespace App\Infrastructure\Persistence\Models;

use App\Infrastructure\Persistence\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ServiceLogModel extends Model
{
    use HasUuids, HasFactory, BelongsToTenant;

    protected $table = 'service_logs';

    protected $fillable = [
        'tenant_id', 'client_resource_id', 'service_id', 'service_variant_id', 'reservation_id',
        'attended_by', 'created_by', 'washed_by', 'dried_by', 'started_at', 'finished_at',
        'price_charged', 'price_change_reason', 'price_change_note',
        'payment_method', 'payment_bank', 'payment_status', 'left_owing', 'paid_at',
        'invoiced', 'invoiced_at',
        'invoice_external_id', 'invoice_status', 'invoice_clave_acceso',
        'invoice_numero_autorizacion', 'invoice_error',
        'status', 'notes', 'log_date',
        'consumption_applied_at',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
            'price_charged' => 'decimal:2',
            'log_date' => 'date',
            'consumption_applied_at' => 'datetime',
            'paid_at' => 'datetime',
            'left_owing' => 'boolean',
            'invoiced' => 'boolean',
            'invoiced_at' => 'datetime',
        ];
    }

    public function variant()
    {
        return $this->belongsTo(ServiceVariantModel::class, 'service_variant_id');
    }

    public function items()
    {
        return $this->hasMany(ServiceLogItemModel::class, 'service_log_id')->orderBy('sort_order');
    }

    /** Bitácora del servicio, del más viejo al más nuevo: se lee como relato. */
    public function events()
    {
        return $this->hasMany(ServiceLogEventModel::class, 'service_log_id')
            ->orderBy('changed_at');
    }

    /**
     * Sólo los cambios de precio, del más nuevo al más viejo. Existe aparte de
     * `events` porque la lista del día necesita el último para decir quién
     * tocó el precio, y cargar la bitácora entera son N filas por registro.
     *
     * El desempate por `id` importa: dos cambios del mismo segundo comparten
     * `changed_at`, y el id es UUIDv7 — ordena por tiempo de creación.
     */
    public function priceChanges()
    {
        return $this->hasMany(ServiceLogEventModel::class, 'service_log_id')
            ->where('event', 'price_changed')
            ->orderByDesc('changed_at')
            ->orderByDesc('id');
    }

    /**
     * El desvío del catálogo de esta fila, o null si no hay ninguno. Necesita
     * `items` cargado.
     *
     * Una línea sin `catalog_price` es histórica, no un descuento: sin la foto
     * no hay contra qué comparar, y consultar el catálogo de hoy convertiría
     * cada subida de precio en descuentos fantasma sobre ventas viejas.
     */
    public function catalogDeviation(): ?array
    {
        $conFoto = $this->items->filter(fn ($i) => $i->catalog_price !== null);
        if ($conFoto->isEmpty()) {
            return null;
        }

        $catalog = round((float) $conFoto->sum(fn ($i) => (float) $i->catalog_price * (float) $i->qty), 2);
        $charged = round((float) $conFoto->sum(fn ($i) => (float) $i->unit_price * (float) $i->qty), 2);
        $dif     = round($charged - $catalog, 2);

        // Centavos, no igualdad exacta: el precio va y vuelve por JSON.
        if (abs($dif) <= 0.005) {
            return null;
        }

        return [
            'catalog'    => $catalog,
            'charged'    => $charged,
            'difference' => $dif,
            'label'      => $conFoto->first()->label,
        ];
    }

    public function tenant()
    {
        return $this->belongsTo(TenantModel::class, 'tenant_id');
    }

    public function clientResource()
    {
        return $this->belongsTo(ClientResourceModel::class, 'client_resource_id');
    }

    public function service()
    {
        return $this->belongsTo(ServiceModel::class, 'service_id');
    }

    public function reservation()
    {
        return $this->belongsTo(ReservationModel::class, 'reservation_id');
    }

    public function attendant()
    {
        return $this->belongsTo(UserModel::class, 'attended_by');
    }

    /** Quién lavó — catálogo service_staff, no un usuario de la app. */
    public function washer()
    {
        return $this->belongsTo(ServiceStaffModel::class, 'washed_by');
    }

    /** Quién secó. */
    public function dryer()
    {
        return $this->belongsTo(ServiceStaffModel::class, 'dried_by');
    }

    public function creator()
    {
        return $this->belongsTo(UserModel::class, 'created_by');
    }

    protected static function newFactory()
    {
        return \Database\Factories\ServiceLogModelFactory::new();
    }
}
