<?php

namespace App\Infrastructure\Persistence\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class UserModel extends Authenticatable
{
    use HasUuids, HasFactory, Notifiable, HasApiTokens;

    protected $table = 'users';

    protected $fillable = [
        'name', 'email', 'password', 'phone', 'is_super_admin',
    ];

    protected $hidden = [
        'password', 'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_super_admin' => 'boolean',
        ];
    }

    public function tenants()
    {
        return $this->belongsToMany(TenantModel::class, 'tenant_users', 'user_id', 'tenant_id')
            ->withPivot('role', 'is_active')
            ->withTimestamps();
    }

    public function vehicles()
    {
        return $this->hasMany(VehicleModel::class, 'owner_id');
    }

    protected static function newFactory()
    {
        return \Database\Factories\UserModelFactory::new();
    }
}
