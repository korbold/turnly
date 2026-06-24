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
            'created_by'     => $this->created_by,
            'started_at'     => $this->started_at?->toIso8601String(),
            'finished_at'    => $this->finished_at?->toIso8601String(),
            'price_charged'  => (float) $this->price_charged,
            'payment_method' => $this->payment_method,
            'payment_bank'   => $this->payment_bank,
            'payment_status' => $this->payment_status,
            'paid_at'        => $this->paid_at?->toIso8601String(),
            'status'         => $this->status,
            'notes'          => $this->notes,
            'log_date'       => $this->log_date,
            'created_at'     => $this->created_at?->toIso8601String(),

            'client_resource' => $this->whenLoaded('clientResource', fn () => [
                'id'    => $this->clientResource->id,
                'label' => ClientResourceResource::labelFrom($this->clientResource->data),
                'data'  => $this->clientResource->data,
            ]),

            'service' => $this->whenLoaded('service', fn () => [
                'name' => $this->service->name,
            ]),

            'attendant' => $this->whenLoaded('attendant', fn () => [
                'name' => $this->attendant->name,
            ]),

            // Multi-service breakdown — loaded only when the caller
            // asked for `items` so we don't fan-out queries on list
            // endpoints that don't need it. `services_summary` is a
            // compact rollup the LogList row can render without
            // touching each item.
            'items' => $this->whenLoaded('items', fn () => $this->items->map(fn ($it) => [
                'id'         => $it->id,
                'item_type'  => $it->item_type,
                'ref_id'     => $it->ref_id,
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
        ];
    }

    /**
     * Preserve decimal notation for whole-number floats (e.g. 40.0 not 40)
     * so assertJsonPath comparisons with float literals work correctly.
     */
    public function jsonOptions(): int
    {
        return JSON_PRESERVE_ZERO_FRACTION;
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
