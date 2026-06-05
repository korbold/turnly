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
            // Method becomes optional once "Cobrar al retirar" lands —
            // the cashier registers the service first and stamps the
            // method later via the dedicated payment endpoint.
            'payment_method'  => ['nullable', 'in:cash,card,transfer,other'],
            // Bank slug (pichincha, pacifico, …) only meaningful when
            // payment_method = transfer.
            'payment_bank'    => ['nullable', 'string', 'max:40'],
            // Whether the cashier is collecting now ("paid") or
            // deferring until pickup ("unpaid"). When omitted, the
            // controller defaults to "paid" to preserve the pre-Fase-B
            // behaviour for older clients.
            'payment_status'  => ['nullable', 'in:paid,unpaid'],
            'reservation_id'  => ['nullable', 'uuid'],
            'notes'           => ['nullable', 'string', 'max:500'],
        ];
    }
}
