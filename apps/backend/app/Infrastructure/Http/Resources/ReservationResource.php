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
            'vehicle_id'    => $this->vehicle_id,
            'service_id'    => $this->service_id,
            'assigned_to'   => $this->assigned_to,
            'scheduled_at'  => $this->scheduled_at?->toIso8601String(),
            'estimated_end' => $this->estimated_end?->toIso8601String(),
            'status'        => $this->status,
            'notes'         => $this->notes,
            'cancelled_at'  => $this->cancelled_at?->toIso8601String(),
            'cancel_reason' => $this->cancel_reason,
            'created_by'    => $this->created_by,
            'created_at'    => $this->created_at?->toIso8601String(),

            'vehicle' => $this->whenLoaded('vehicle', fn () => [
                'plate' => $this->vehicle->plate,
                'brand' => $this->vehicle->brand,
                'model' => $this->vehicle->model,
                'color' => $this->vehicle->color,
            ]),

            'service' => $this->whenLoaded('service', fn () => [
                'name'             => $this->service->name,
                'price'            => $this->service->price,
                'duration_minutes' => $this->service->duration_minutes,
            ]),

            'client' => $this->whenLoaded('client', fn () => [
                'name'  => $this->client->name,
                'email' => $this->client->email,
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
