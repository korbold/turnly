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
            'price_charged'  => $this->price_charged,
            'payment_method' => $this->payment_method,
            'status'         => $this->status,
            'notes'          => $this->notes,
            'log_date'       => $this->log_date,
            'created_at'     => $this->created_at?->toIso8601String(),

            'client_resource' => $this->whenLoaded('clientResource', fn () => [
                'label' => $this->clientResource->label,
                'plate' => $this->clientResource->plate,
                'brand' => $this->clientResource->brand,
            ]),

            'service' => $this->whenLoaded('service', fn () => [
                'name' => $this->service->name,
            ]),

            'attendant' => $this->whenLoaded('attendant', fn () => [
                'name' => $this->attendant->name,
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
