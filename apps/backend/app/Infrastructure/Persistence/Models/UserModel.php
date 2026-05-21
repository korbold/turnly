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

    // is_super_admin is intentionally NOT in $fillable so a stray
    // mass-assign (e.g. update($request->validated())) cannot escalate a
    // regular user to super-admin. EloquentUserRepository::save uses
    // forceFill() when a legitimate code path needs to set it.
    protected $fillable = [
        'name', 'email', 'password', 'phone',
        'terms_accepted_at', 'terms_version_accepted',
        'deletion_requested_at',
    ];

    protected $hidden = [
        'password', 'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'terms_accepted_at' => 'datetime',
            'deletion_requested_at' => 'datetime',
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

    public function clientResources()
    {
        return $this->hasMany(ClientResourceModel::class, 'client_id');
    }

    protected static function newFactory()
    {
        return \Database\Factories\UserModelFactory::new();
    }
}
