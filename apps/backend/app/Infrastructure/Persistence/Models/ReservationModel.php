<?php

namespace App\Infrastructure\Persistence\Models;

use App\Infrastructure\Persistence\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ReservationModel extends Model
{
    use HasUuids, HasFactory, SoftDeletes, BelongsToTenant;

    protected $table = 'reservations';

    protected $fillable = [
        'tenant_id', 'client_id', 'client_resource_id', 'service_id', 'service_variant_id',
        'assigned_to', 'scheduled_at', 'estimated_end', 'status',
        'notes', 'cancelled_at', 'cancel_reason', 'created_by',
        'consumption_applied_at',
        'checked_in_at', 'billing_snapshot',
        'client_rescheduled_at',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_at' => 'datetime',
            'estimated_end' => 'datetime',
            'cancelled_at' => 'datetime',
            'consumption_applied_at' => 'datetime',
            'checked_in_at' => 'datetime',
            'client_rescheduled_at' => 'datetime',
            'billing_snapshot' => 'array',
        ];
    }

    public function items()
    {
        return $this->hasMany(ReservationItemModel::class, 'reservation_id')->orderBy('sort_order');
    }

    public function itemChanges()
    {
        return $this->hasMany(ReservationItemChangeModel::class, 'reservation_id')->orderByDesc('changed_at');
    }

    public function variant()
    {
        return $this->belongsTo(ServiceVariantModel::class, 'service_variant_id');
    }

    public function tenant()
    {
        return $this->belongsTo(TenantModel::class, 'tenant_id');
    }

    public function client()
    {
        return $this->belongsTo(UserModel::class, 'client_id');
    }

    public function clientResource()
    {
        return $this->belongsTo(ClientResourceModel::class, 'client_resource_id');
    }

    public function service()
    {
        return $this->belongsTo(ServiceModel::class, 'service_id');
    }

    public function assignedEmployee()
    {
        return $this->belongsTo(UserModel::class, 'assigned_to');
    }

    public function creator()
    {
        return $this->belongsTo(UserModel::class, 'created_by');
    }

    public function serviceLog()
    {
        return $this->hasOne(ServiceLogModel::class, 'reservation_id');
    }

    public function reminders()
    {
        return $this->hasMany(ReservationReminderModel::class, 'reservation_id');
    }

    protected static function newFactory()
    {
        return \Database\Factories\ReservationModelFactory::new();
    }
}
