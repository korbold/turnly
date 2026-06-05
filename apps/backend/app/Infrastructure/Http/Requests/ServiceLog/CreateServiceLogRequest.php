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
            // service_id stays required as the "primary" service so
            // legacy reads (reports filtering by service, summary
            // grouping) keep working without joining items. With items[]
            // present, the controller derives it from the first line.
            'service_id'         => ['required_without:items', 'uuid'],
            'service_variant_id' => ['nullable', 'uuid'],
            'attended_by'     => ['required', 'uuid'],
            'price_charged'   => ['required_without:items', 'numeric', 'min:0'],
            // Multi-service items — when present, the controller sums
            // their line totals into price_charged and persists each as
            // a service_log_item row.
            'items'                => ['nullable', 'array', 'min:1'],
            'items.*.service_id'   => ['required_with:items', 'uuid'],
            'items.*.label'        => ['required_with:items', 'string', 'max:160'],
            'items.*.qty'          => ['required_with:items', 'numeric', 'min:0.01'],
            'items.*.unit_price'   => ['required_with:items', 'numeric', 'min:0'],
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
