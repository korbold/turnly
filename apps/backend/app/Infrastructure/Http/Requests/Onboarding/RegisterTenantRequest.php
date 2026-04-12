<?php

namespace App\Infrastructure\Http\Requests\Onboarding;

use Illuminate\Foundation\Http\FormRequest;

class RegisterTenantRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name'       => ['required', 'string', 'max:255'],
            'slug'       => ['required', 'string', 'max:100', 'regex:/^[a-z0-9-]+$/', 'unique:tenants'],
            'owner_name' => ['required', 'string', 'max:255'],
            'email'      => ['required', 'email', 'unique:tenants'],
            'password'   => ['required', 'string', 'min:8'],
            'phone'      => ['nullable', 'string', 'max:20'],
            'city'       => ['nullable', 'string', 'max:100'],
            'country'    => ['nullable', 'string', 'size:2'],
        ];
    }
}
