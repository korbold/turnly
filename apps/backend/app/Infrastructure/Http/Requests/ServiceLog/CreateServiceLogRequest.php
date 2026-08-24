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
            // Nullable so a counter sale — a product handed over without
            // washing anything, to someone with no vehicle on file — can
            // be registered unattached. withValidator brings the vehicle
            // back as mandatory the moment a service line is present.
            'client_resource_id' => ['nullable', 'uuid'],
            // service_id stays required as the "primary" service so
            // legacy reads (reports filtering by service, summary
            // grouping) keep working without joining items. With items[]
            // present, the controller derives it from the first line.
            // Explicitly null on a product-only ticket — the admin still
            // echoes the key, so `nullable` has to come before `uuid`.
            'service_id'         => ['nullable', 'required_without:items', 'uuid'],
            'service_variant_id' => ['nullable', 'uuid'],
            'attended_by'     => ['required', 'uuid'],
            'washed_by' => 'nullable|uuid|exists:service_staff,id',
            'dried_by'  => 'nullable|uuid|exists:service_staff,id',
            'price_charged'   => ['required_without:items', 'numeric', 'min:0'],
            // Multi-service items — when present, the controller sums
            // their line totals into price_charged and persists each as
            // a service_log_item row.
            'items'                => ['nullable', 'array', 'min:1'],
            // A line is either a service (service_id, optional variant)
            // or a counter-sale product (product_id). withValidator
            // enforces exactly one of the two per line.
            'items.*.item_type'    => ['nullable', 'in:service_variant,product'],
            // exists: an unmarked product line would otherwise put a
            // product uuid in service_logs.service_id and break the
            // foreign key mid-write. A 422 says what went wrong.
            'items.*.service_id'   => ['nullable', 'uuid', 'exists:services,id'],
            'items.*.product_id'   => ['nullable', 'uuid', 'exists:products,id'],
            // Variant picked for the line. Persisted as the item's
            // ref_id so reports + history point at the exact variant
            // the cashier saw on screen.
            'items.*.variant_id'   => ['nullable', 'uuid'],
            'items.*.label'        => ['required_with:items', 'string', 'max:160'],
            'items.*.qty'          => ['required_with:items', 'numeric', 'min:0.01'],
            'items.*.unit_price'   => ['required_with:items', 'numeric', 'min:0'],
            // Method becomes optional once "Cobrar al retirar" lands —
            // the cashier registers the service first and stamps the
            // method later via the dedicated payment endpoint.
            'payment_method'  => ['nullable', 'in:cash,card,transfer,other'],
            // Abono al registrar: el cliente deja el auto y paga una parte.
            // Sin el campo, se cobra el total, que es como se comportaba antes.
            'amount_received' => ['nullable', 'numeric', 'min:0.01'],
            // Motivo del desvío de precio. Obligatorio sin el privilegio
            // Precio; la validación fina vive en el controlador porque
            // depende de si hubo desvío.
            'price_change_reason' => ['nullable', 'string', 'max:40'],
            'price_change_note'   => ['nullable', 'string', 'max:200'],
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

    /**
     * `exists:service_staff,id` deja pasar personal de otro tenant. El
     * scope no se puede expresar en la regla porque el tenant vive en el
     * contenedor, no en el request.
     */
    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            // A service is rendered *on* something, so it keeps needing a
            // vehicle/resource. Only a products-only ticket may go
            // unattached. No items[] at all is the legacy single-service
            // payload, which is a service by definition.
            $items = (array) $this->input('items', []);
            $hasServiceLine = $items === [] || collect($items)->contains(
                fn ($line) => ($line['item_type'] ?? 'service_variant') !== 'product',
            );

            if ($hasServiceLine && blank($this->input('client_resource_id'))) {
                $validator->errors()->add(
                    'client_resource_id',
                    'Un servicio se registra sobre un vehículo o cliente.',
                );
            }

            foreach ($items as $i => $line) {
                $isProduct = ($line['item_type'] ?? 'service_variant') === 'product';
                $ref = $isProduct ? ($line['product_id'] ?? null) : ($line['service_id'] ?? null);

                if (empty($ref)) {
                    $validator->errors()->add(
                        $isProduct ? "items.$i.product_id" : "items.$i.service_id",
                        $isProduct
                            ? 'Falta el producto de la línea.'
                            : 'Falta el servicio de la línea.',
                    );
                }
            }

            foreach (['washed_by', 'dried_by'] as $field) {
                $id = $this->input($field);
                if (!$id) {
                    continue;
                }

                $belongs = \App\Infrastructure\Persistence\Models\ServiceStaffModel::query()
                    ->where('id', $id)
                    ->where('is_active', true)
                    ->exists();

                if (!$belongs) {
                    $validator->errors()->add($field, 'El personal seleccionado no pertenece a este negocio.');
                }
            }
        });
    }
}
