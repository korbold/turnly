<?php

namespace App\Infrastructure\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ServiceLogResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'             => $this->id,
            'client_resource_id' => $this->client_resource_id,
            'service_id'     => $this->service_id,
            'reservation_id' => $this->reservation_id,
            'attended_by'    => $this->attended_by,
            'washed_by'      => $this->washed_by,
            'dried_by'       => $this->dried_by,
            'created_by'     => $this->created_by,
            'started_at'     => $this->started_at?->toIso8601String(),
            'finished_at'    => $this->finished_at?->toIso8601String(),
            'price_charged'  => (float) $this->price_charged,
            'payment_method' => $this->payment_method,
            'payment_bank'   => $this->payment_bank,
            'payment_status' => $this->payment_status,
            'paid_at'        => $this->paid_at?->toIso8601String(),
            'invoiced'       => (bool) $this->invoiced,
            'invoiced_at'    => $this->invoiced_at?->toIso8601String(),
            'invoice_external_id'         => $this->invoice_external_id,
            'invoice_status'              => $this->invoice_status,
            'invoice_clave_acceso'        => $this->invoice_clave_acceso,
            'invoice_numero_autorizacion' => $this->invoice_numero_autorizacion,
            'invoice_error'               => $this->invoice_error,
            'status'         => $this->status,
            'notes'          => $this->notes,
            'log_date'       => $this->log_date,
            'created_at'     => $this->created_at?->toIso8601String(),

            'client_resource' => $this->whenLoaded('clientResource', fn () => [
                'id'    => $this->clientResource->id,
                'label' => ClientResourceResource::labelFrom($this->clientResource->data),
                'data'  => $this->clientResource->data,
                'plate' => $this->clientResource->plate,
                'client' => $this->clientResource->relationLoaded('client') && $this->clientResource->client
                    ? ['name' => $this->clientResource->client->name, 'email' => $this->clientResource->client->email]
                    : null,
            ]),

            'service' => $this->whenLoaded('service', fn () => [
                'name' => $this->service->name,
            ]),

            'attendant' => $this->whenLoaded('attendant', fn () => [
                'name' => $this->attendant->name,
            ]),

            // Nombres del personal que ejecutó el trabajo. La fila de la
            // lista los muestra y el detalle los usa para el reclamo.
            'washer' => $this->whenLoaded('washer', fn () => $this->washer ? [
                'id'   => $this->washer->id,
                'name' => $this->washer->name,
            ] : null),

            'dryer' => $this->whenLoaded('dryer', fn () => $this->dryer ? [
                'id'   => $this->dryer->id,
                'name' => $this->dryer->name,
            ] : null),

            // Multi-service breakdown — loaded only when the caller
            // asked for `items` so we don't fan-out queries on list
            // endpoints that don't need it. `services_summary` is a
            // compact rollup the LogList row can render without
            // touching each item.
            'items' => $this->whenLoaded('items', fn () => $this->items->map(fn ($it) => [
                'id'         => $it->id,
                'item_type'  => $it->item_type,
                'ref_id'     => $it->ref_id,
                // For variant items ref_id is the variant UUID; expose the
                // parent service_id so the edit dialog can send service_id
                // to the updateItems endpoint without a separate lookup.
                'service_id' => $it->relationLoaded('variant') && $it->variant
                    ? $it->variant->service_id
                    : $it->ref_id,
                'label'      => $it->label,
                'qty'        => (float) $it->qty,
                'unit_price' => (float) $it->unit_price,
                'line_total' => (float) $it->line_total,
                'sort_order' => (int) $it->sort_order,
            ])),

            'services_summary' => $this->whenLoaded('items', fn () => [
                'count'  => $this->items->count(),
                'labels' => $this->items
                    ->map(fn ($it) => preg_replace('/\s·\s.*$/u', '', (string) $it->label))
                    ->filter()
                    ->values(),
            ]),

            // Bitácora. Solo cuando el llamador la pidió: son N filas por
            // registro y la lista del día no la usa.
            'events' => $this->whenLoaded('events', fn () => $this->events->map(fn ($e) => [
                'id'         => $e->id,
                'event'      => $e->event,
                'detail'     => $e->detail ?? [],
                'changed_at' => $e->changed_at?->toIso8601String(),
                'changed_by' => $e->relationLoaded('changedBy') && $e->changedBy
                    ? ['id' => $e->changedBy->id, 'name' => $e->changedBy->name]
                    : null,
            ])),
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
