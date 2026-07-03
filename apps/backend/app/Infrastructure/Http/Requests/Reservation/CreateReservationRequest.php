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
            'business_resource_id' => ['nullable', 'uuid', 'exists:business_resources,id,tenant_id,' . app('current_tenant_id')],
            // service_id is required only when items[] is not provided.
            'service_id'         => ['required_without:items', 'nullable', 'uuid'],
            'service_variant_id' => ['nullable', 'uuid'],
            'items'              => ['nullable', 'array', 'min:1', 'max:10'],
            'items.*.service_variant_id' => ['required_with:items', 'uuid'],
            'items.*.qty'                => ['nullable', 'integer', 'min:1', 'max:10'],
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
