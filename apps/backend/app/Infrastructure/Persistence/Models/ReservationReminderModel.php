<?php

namespace App\Infrastructure\Persistence\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class ReservationReminderModel extends Model
{
    use HasUuids;

    protected $table = 'reservation_reminders';

    public $timestamps = false;

    protected $fillable = [
        'reservation_id',
        'type',
        'sent_at',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'sent_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    public function reservation()
    {
        return $this->belongsTo(ReservationModel::class, 'reservation_id');
    }
}
