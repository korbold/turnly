<?php

namespace App\Infrastructure\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ClientResourceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'         => $this->id,
            'client_id'  => $this->client_id,
            'label'      => $this->label,
            'data'       => $this->data,
            'plate'      => $this->plate,
            'brand'      => $this->brand,
            'model'      => $this->model,
            'color'      => $this->color,
            'type'       => $this->type,
            'created_at' => $this->created_at?->toIso8601String(),

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
