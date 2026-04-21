<?php

namespace App\Infrastructure\Http\Controllers\Tenant;

use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Http\Resources\TenantResource;
use App\Infrastructure\Persistence\Models\TenantModel;
use Illuminate\Http\Request;

class TenantSettingsController extends Controller
{
    public function show(): TenantResource
    {
        $tenant = TenantModel::findOrFail(app('current_tenant_id'));
        return new TenantResource($tenant);
    }

    public function update(Request $request): TenantResource
    {
        $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'sometimes|nullable|string',
            'address' => 'sometimes|nullable|string|max:500',
            'phone' => 'sometimes|nullable|string|max:50',
            'business_type' => 'sometimes|string|in:car_wash,barbershop,medical,spa,gym,other',
            'custom_fields' => 'sometimes|nullable|array',
            'custom_fields.*.key' => 'required_with:custom_fields|string',
            'custom_fields.*.label' => 'required_with:custom_fields|string',
            'custom_fields.*.type' => 'required_with:custom_fields|string',
            'custom_fields.*.required' => 'required_with:custom_fields|boolean',
            'social_links' => 'sometimes|nullable|array',
            'brand_theme' => 'sometimes|string|in:blue,green,red,purple,orange,teal,pink,gray',
            'settings' => 'sometimes|nullable|array',
            'onboarding_step' => 'sometimes|nullable|integer|min:0',
            'logo_url' => 'nullable|string|max:500',
            'cover_url' => 'nullable|string|max:500',
            'slot_duration' => 'sometimes|integer|min:5|max:480',
            'cancellation_hours' => 'sometimes|integer|min:0|max:72',
        ]);

        $tenant = TenantModel::findOrFail(app('current_tenant_id'));

        $tenant->update($request->only([
            'name',
            'description',
            'address',
            'phone',
            'business_type',
            'custom_fields',
            'social_links',
            'brand_theme',
            'onboarding_step',
            'logo_url',
            'cover_url',
        ]));

        // Merge slot_duration and cancellation_hours into settings JSON
        $settings = $tenant->settings ?? [];
        if ($request->has('slot_duration')) {
            $settings['slot_duration_minutes'] = (int) $request->slot_duration;
        }
        if ($request->has('cancellation_hours')) {
            $settings['cancellation_hours'] = (int) $request->cancellation_hours;
        }
        if ($request->has('settings')) {
            $settings = array_merge($settings, $request->settings);
        }
        $tenant->update(['settings' => $settings]);

        return new TenantResource($tenant->fresh());
    }
}
