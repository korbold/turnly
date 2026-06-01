<?php

namespace App\Infrastructure\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class LoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // Either an email or a username. The controller routes on the
            // presence of `@` to decide which column to query.
            'identifier' => ['required_without:email', 'string', 'max:255'],
            'email'      => ['required_without:identifier', 'string', 'max:255'],
            'password'   => ['required', 'string'],
        ];
    }

    public function identifier(): string
    {
        return (string) ($this->input('identifier') ?? $this->input('email'));
    }
}
