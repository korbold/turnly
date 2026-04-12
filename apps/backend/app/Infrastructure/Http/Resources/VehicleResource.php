<?php

namespace App\Infrastructure\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class VehicleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'         => $this->id,
            'owner_id'   => $this->owner_id,
            'plate'      => $this->plate,
            'brand'      => $this->brand,
            'model'      => $this->model,
            'color'      => $this->color,
            'type'       => $this->type,
            'created_at' => $this->created_at?->toIso8601String(),

            'owner' => $this->whenLoaded('owner', fn () => [
                'name'  => $this->owner->name,
                'email' => $this->owner->email,
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
