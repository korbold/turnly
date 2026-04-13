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
        ];
    }
}
