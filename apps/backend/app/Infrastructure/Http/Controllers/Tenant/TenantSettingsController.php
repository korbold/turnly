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
            'settings',
            'onboarding_step',
        ]));

        return new TenantResource($tenant);
    }
}
