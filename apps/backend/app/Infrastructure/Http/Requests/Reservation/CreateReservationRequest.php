<?php

namespace App\Infrastructure\Http\Requests\Reservation;

use Illuminate\Foundation\Http\FormRequest;

class CreateReservationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'client_resource_id' => ['nullable', 'uuid'],
            'service_id'   => ['required', 'uuid'],
            'scheduled_at' => ['required', 'date', 'after:now'],
            'assigned_to'  => ['nullable', 'uuid'],
            'notes'        => ['nullable', 'string', 'max:500'],
        ];
    }
}
