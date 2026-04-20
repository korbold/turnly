<?php

namespace App\Infrastructure\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class GoogleLoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'id_token' => ['required', 'string'],
        ];
    }

    public function messages(): array
    {
        return [
            'id_token.required' => 'El token de Google es obligatorio.',
        ];
    }
}
