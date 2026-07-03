<?php

namespace App\Infrastructure\Http\Requests\ClientResource;

use Illuminate\Foundation\Http\FormRequest;

class CreateClientResourceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'client_id' => ['nullable', 'uuid', 'exists:users,id'],
            'data'   => ['nullable', 'array'],
            'plate'  => ['nullable', 'string', 'max:20'],
            'brand'  => ['nullable', 'string', 'max:100'],
            'model'  => ['nullable', 'string', 'max:100'],
            'color'  => ['nullable', 'string', 'max:50'],
            'type'   => ['nullable', 'in:sedan,suv,pickup,van,motorcycle,other'],
            // Optional billing snapshot persisted into
            // user_billing_profiles when the cashier captures
            // facturación data alongside the new resource (Fase D).
            'billing_profile'             => ['nullable', 'array'],
            'billing_profile.doc_type'    => ['required_with:billing_profile', 'in:ruc,cedula,passport,final_consumer'],
            'billing_profile.doc_number'  => ['nullable', 'string', 'max:13'],
            'billing_profile.legal_name'  => ['nullable', 'string', 'max:255'],
            'billing_profile.email'       => ['nullable', 'email', 'max:255'],
            'billing_profile.address'     => ['nullable', 'string', 'max:500'],
            'billing_profile.phone'       => ['nullable', 'string', 'max:30'],
        ];
    }
}
