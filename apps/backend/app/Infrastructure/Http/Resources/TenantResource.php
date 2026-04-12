<?php

namespace App\Infrastructure\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TenantResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'              => $this->id,
            'slug'            => $this->slug,
            'name'            => $this->name,
            'owner_name'      => $this->owner_name,
            'email'           => $this->email,
            'phone'           => $this->phone,
            'city'            => $this->city,
            'country'         => $this->country,
            'plan'            => $this->plan,
            'status'          => $this->status,
            'trial_ends_at'   => $this->trial_ends_at?->toIso8601String(),
            'onboarding_step' => $this->onboarding_step,
            'activated_at'    => $this->activated_at?->toIso8601String(),
            'created_at'      => $this->created_at?->toIso8601String(),
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
