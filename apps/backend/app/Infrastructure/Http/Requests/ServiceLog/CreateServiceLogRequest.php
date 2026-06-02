<?php

namespace App\Infrastructure\Http\Requests\ServiceLog;

use Illuminate\Foundation\Http\FormRequest;

class CreateServiceLogRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'client_resource_id' => ['required', 'uuid'],
            'service_id'         => ['required', 'uuid'],
            'service_variant_id' => ['nullable', 'uuid'],
            'attended_by'     => ['required', 'uuid'],
            'price_charged'   => ['required', 'numeric', 'min:0'],
            'payment_method'  => ['required', 'in:cash,card,transfer,other'],
            'reservation_id'  => ['nullable', 'uuid'],
            'notes'           => ['nullable', 'string', 'max:500'],
        ];
    }
}
