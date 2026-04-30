<?php

declare(strict_types=1);

namespace App\Infrastructure\Http\Requests\Tenant;

use App\Domain\Shared\Identification\EcIdValidator;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateBillingProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'tax_id_type' => ['required', 'string', 'in:ruc,cedula,pasaporte'],
            'tax_id' => ['required', 'string', 'max:20', $this->idRule()],
            'legal_name' => ['required', 'string', 'max:255'],
            'billing_email' => ['required', 'email', 'max:255'],
            'billing_address' => ['required', 'string', 'max:255'],
            'billing_phone' => ['nullable', 'string', 'max:20'],
        ];
    }

    public function messages(): array
    {
        return [
            'tax_id_type.required' => 'Selecciona el tipo de identificación.',
            'tax_id.required' => 'El número de identificación es obligatorio.',
            'legal_name.required' => 'La razón social es obligatoria.',
            'billing_email.required' => 'El email de facturación es obligatorio.',
            'billing_email.email' => 'El email de facturación no es válido.',
            'billing_address.required' => 'La dirección es obligatoria.',
        ];
    }

    private function idRule(): ValidationRule
    {
        $type = (string) $this->input('tax_id_type', '');

        return new class($type) implements ValidationRule {
            public function __construct(private string $type) {}

            public function validate(string $attribute, mixed $value, \Closure $fail): void
            {
                if (!is_string($value) || !EcIdValidator::validate($this->type, $value)) {
                    $fail('El número de identificación no es válido.');
                }
            }
        };
    }
}
