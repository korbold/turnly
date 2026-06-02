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
            'client_id'          => ['nullable', 'uuid'],
            'client_resource_id' => ['nullable', 'uuid'],
            'service_id'         => ['required', 'uuid'],
            'service_variant_id' => ['nullable', 'uuid'],
            'scheduled_at'       => ['required', 'date', 'after:now'],
            'assigned_to'        => ['nullable', 'uuid'],
            'notes'              => ['nullable', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'scheduled_at.after' => 'La fecha y hora debe ser posterior a la actual.',
            'scheduled_at.required' => 'La fecha y hora es obligatoria.',
            'service_id.required' => 'El servicio es obligatorio.',
        ];
    }
}
