<?php

namespace App\Infrastructure\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ReservationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'            => $this->id,
            'client_id'     => $this->client_id,
            'client_resource_id' => $this->client_resource_id,
            'business_resource_id' => $this->business_resource_id,
            'service_id'    => $this->service_id,
            'assigned_to'   => $this->assigned_to,
            'scheduled_at'  => $this->scheduled_at?->toIso8601String(),
            'estimated_end' => $this->estimated_end?->toIso8601String(),
            'status'        => $this->status,
            'notes'         => $this->notes,
            'cancelled_at'  => $this->cancelled_at?->toIso8601String(),
            'cancel_reason' => $this->cancel_reason,
            'client_rescheduled_at' => $this->client_rescheduled_at?->toIso8601String(),
            'created_by'    => $this->created_by,
            'created_at'    => $this->created_at?->toIso8601String(),

            // Check-in artefacts. `checked_in_at` is the wall-clock the
            // cashier captured the customer; `billing_snapshot` is the
            // frozen billing payload used for the eventual SRI invoice.
            'checked_in_at'    => $this->checked_in_at?->toIso8601String(),
            'billing_snapshot' => $this->billing_snapshot,

            // Phase 1 pago — independent of lifecycle status.
            'payment_status'    => $this->payment_status,
            'payment_method'    => $this->payment_method,
            'paid_at'           => $this->paid_at?->toIso8601String(),
            'payment_reference' => $this->payment_reference,
            'payment_bank'      => $this->payment_bank,

            // SRI invoice fields
            'invoiced'                    => (bool) $this->invoiced,
            'invoiced_at'                 => $this->invoiced_at?->toIso8601String(),
            'invoice_external_id'         => $this->invoice_external_id,
            'invoice_status'              => $this->invoice_status,
            'invoice_clave_acceso'        => $this->invoice_clave_acceso,
            'invoice_numero_autorizacion' => $this->invoice_numero_autorizacion,
            'invoice_error'               => $this->invoice_error,

            'client_resource' => $this->whenLoaded('clientResource', fn () => [
                'id'    => $this->clientResource->id,
                'label' => ClientResourceResource::labelFrom($this->clientResource->data),
                'data'  => $this->clientResource->data,
            ]),

            'service' => $this->whenLoaded('service', fn () => [
                'name'             => $this->service->name,
                'price'            => $this->service->price,
            ]),

            // Compact services summary so list views can render the
            // multi-service label without firing a follow-up /items
            // request per row. Loaded only when the caller asked for
            // the items relationship.
            'services_summary' => $this->whenLoaded('items', fn () => [
                'count'  => $this->items->count(),
                'labels' => $this->items
                    ->map(fn ($it) => preg_replace('/\s·\s.*$/u', '', (string) $it->label))
                    ->filter()
                    ->values(),
            ]),

            'client' => $this->whenLoaded('client', fn () => [
                'name'  => $this->client->name,
                'email' => $this->client->email,
                // The client's default SRI billing profile, so the check-in
                // dialog can prefill documento / razón social / dirección /
                // teléfono from what was captured on a prior visit.
                'default_billing_profile' => $this->client->relationLoaded('defaultBillingProfile')
                    && $this->client->defaultBillingProfile
                    ? [
                        'id'         => $this->client->defaultBillingProfile->id,
                        'doc_type'   => $this->client->defaultBillingProfile->doc_type,
                        'doc_number' => $this->client->defaultBillingProfile->doc_number,
                        'legal_name' => $this->client->defaultBillingProfile->legal_name,
                        'email'      => $this->client->defaultBillingProfile->email,
                        'address'    => $this->client->defaultBillingProfile->address,
                        'phone'      => $this->client->defaultBillingProfile->phone,
                    ]
                    : null,
            ]),

            'tenant' => $this->whenLoaded('tenant', fn () => [
                'name' => $this->tenant->name,
                'slug' => $this->tenant->slug,
                'cancellation_hours' => $this->tenant->settings['cancellation_hours'] ?? 1,
                'payment_timing'     => $this->tenant->getPaymentTiming(),
                // Con qué escribirle al negocio desde el portal. La pantalla de
                // la cita decía "comunícate con el negocio" sin dar con qué.
                // El país viaja porque wa.me exige el número internacional y
                // aquí se guardan en formato local ("0991213606").
                'whatsapp' => $this->tenant->social_links['whatsapp'] ?? null,
                'phone'    => $this->tenant->phone,
                'country'  => $this->tenant->country,
            ]),
        ];
    }

    public function with(Request $request): array
    {
        return [
            'meta' => [
                'tenant'    => app()->has('current_tenant') ? app('current_tenant')->slug : null,
                'timestamp' => now()->toIso8601String(),
            ],
        ];
    }
}
