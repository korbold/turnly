<?php

namespace App\Infrastructure\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class NotificationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $data = $this->data;

        return [
            'id' => $this->id,
            'type' => class_basename($this->type),
            'title' => $data['title'] ?? '',
            'body' => $data['body'] ?? '',
            'action_type' => $data['action_type'] ?? null,
            'action_id' => $data['action_id'] ?? null,
            'tenant_id' => $data['tenant_id'] ?? null,
            'tenant_name' => $data['tenant_name'] ?? null,
            'icon' => $data['icon'] ?? null,
            'read_at' => $this->read_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }

    public function with(Request $request): array
    {
        return [
            'meta' => [
                'timestamp' => now()->toIso8601String(),
            ],
        ];
    }
}
