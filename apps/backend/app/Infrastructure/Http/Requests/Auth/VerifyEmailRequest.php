<?php

declare(strict_types=1);

namespace App\Infrastructure\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class VerifyEmailRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'email' => ['required', 'email', 'exists:users,email'],
            'code' => ['required', 'string', 'regex:/^\d{6}$/'],
        ];
    }

    public function messages(): array
    {
        return [
            'email.required' => 'El email es obligatorio.',
            'email.exists' => 'No existe una cuenta con ese email.',
            'code.required' => 'El código es obligatorio.',
            'code.regex' => 'El código debe tener 6 dígitos.',
        ];
    }
}
