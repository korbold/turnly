<?php

namespace App\Infrastructure\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ServiceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'               => $this->id,
            'name'             => $this->name,
            'description'      => $this->description,
            'price'            => $this->price,
            'is_active'        => $this->is_active,
            // Si este servicio lleva secado. Decide si `complete()` exige el
            // secador; el resto del catálogo no lo necesita.
            'requires_dryer'   => (bool) $this->requires_dryer,
            'sort_order'       => $this->sort_order,
            'image_url'        => $this->image_url,
            'created_at'       => $this->created_at?->toIso8601String(),
            'variants'         => $this->whenLoaded('variants', fn () =>
                ServiceVariantResource::collection($this->variants)
            ),
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
