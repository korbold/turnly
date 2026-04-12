<?php

namespace App\Infrastructure\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'             => $this->id,
            'name'           => $this->name,
            'email'          => $this->email,
            'phone'          => $this->phone,
            'is_super_admin' => $this->is_super_admin,
            'created_at'     => $this->created_at?->toIso8601String(),

            'role' => $this->when(
                $this->relationLoaded('tenants') && $this->pivot !== null,
                fn () => $this->pivot?->role
            ),
        ];
    }

    public function with(Request $request): array
    {
        return [
            'meta' => [
                'tenant'    => app()->has('current_tenant') ? app('current_tenant')->slug : null,
                'timestamp' => now()->toIso8601String(),
            ],
        ];
    }
}
