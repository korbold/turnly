<?php

namespace App\Infrastructure\Http\Requests\WashLog;

use Illuminate\Foundation\Http\FormRequest;

class CreateWashLogRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'vehicle_id'      => ['required', 'uuid'],
            'service_id'      => ['required', 'uuid'],
            'attended_by'     => ['required', 'uuid'],
            'price_charged'   => ['required', 'numeric', 'min:0'],
            'payment_method'  => ['required', 'in:cash,card,transfer,other'],
            'reservation_id'  => ['nullable', 'uuid'],
            'notes'           => ['nullable', 'string', 'max:500'],
        ];
    }
}
