<?php

namespace App\Infrastructure\Http\Requests\Notification;

use Illuminate\Foundation\Http\FormRequest;

class RegisterDeviceTokenRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'token' => ['required', 'string', 'max:512'],
            'platform' => ['required', 'string', 'in:android,ios,web'],
        ];
    }

    public function messages(): array
    {
        return [
            'token.required' => 'El token del dispositivo es obligatorio.',
            'platform.required' => 'La plataforma es obligatoria.',
            'platform.in' => 'La plataforma debe ser android, ios o web.',
        ];
    }
}
