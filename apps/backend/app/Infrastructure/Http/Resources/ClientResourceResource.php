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
            'label'      => $this->buildLabel(),
            'data'       => $this->data,
            'created_at' => $this->created_at?->toIso8601String(),

            // client_id is nullable (walk-in with no identified owner),
            // so the loaded relation can still be null.
            'client' => $this->whenLoaded('client', fn () => $this->client ? [
                'name'  => $this->client->name,
                'email' => $this->client->email,
            ] : null),
        ];
    }

    private function buildLabel(): string
    {
        return self::labelFrom($this->data);
    }

    public static function labelFrom(mixed $data): string
    {
        if (is_string($data)) {
            $data = json_decode($data, true);
        }

        if (is_array($data) && !empty($data)) {
            $values = array_filter(array_values($data), fn ($v) => is_string($v) && $v !== '');
            if (!empty($values)) {
                return implode(' - ', $values);
            }
        }

        return 'Sin nombre';
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
