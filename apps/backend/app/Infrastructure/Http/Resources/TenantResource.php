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
            'plan_id'         => $this->plan_id,
            'is_trial'        => (bool) $this->is_trial,
            'plan'            => $this->plan ? [
                'id'    => $this->plan->id,
                'name'  => $this->plan->name,
                'slug'  => $this->plan->slug,
                'price' => (float) $this->plan->price,
            ] : null,
            'status'          => $this->status,
            'trial_ends_at'   => $this->trial_ends_at?->toIso8601String(),
            'onboarding_step' => $this->onboarding_step,
            'activated_at'    => $this->activated_at?->toIso8601String(),
            'created_at'      => $this->created_at?->toIso8601String(),
            'business_type'   => $this->business_type,
            'custom_fields'   => $this->custom_fields,
            'description'     => $this->description,
            'address'         => $this->address,
            'logo_url'        => $this->logo_url,
            'cover_url'       => $this->cover_url,
            'social_links'    => $this->social_links,
            'brand_theme'     => $this->brand_theme,
            'slot_duration'       => $this->settings['slot_duration_minutes'] ?? 30,
            'cancellation_hours'  => $this->settings['cancellation_hours'] ?? 1,
            'default_tax_rate'    => $this->settings['default_tax_rate'] ?? 15,
            'auto_confirm_reservations' => (bool) ($this->settings['auto_confirm_reservations'] ?? false),
            'allow_client_resource_selection' => (bool) ($this->settings['allow_client_resource_selection'] ?? false),
            'iva_mode'            => $this->settings['iva_mode'] ?? 'excluded',
            'permissions'         => $this->settings['permissions'] ?? (object) [],
            'require_open_till_for_cash' => (bool) ($this->settings['require_open_till_for_cash'] ?? false),
            'payment_timing'      => $this->getPaymentTiming(),
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
