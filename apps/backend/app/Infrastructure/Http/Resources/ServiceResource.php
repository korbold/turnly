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
            'duration_minutes' => $this->duration_minutes,
            'is_active'        => $this->is_active,
            'sort_order'       => $this->sort_order,
            'created_at'       => $this->created_at?->toIso8601String(),
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
