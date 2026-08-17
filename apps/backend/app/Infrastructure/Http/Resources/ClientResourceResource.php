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
            $values = array_filter(
                self::orderByTenantFields($data),
                fn ($v) => is_string($v) && $v !== '',
            );
            if (!empty($values)) {
                return implode(' - ', $values);
            }
        }

        return 'Sin nombre';
    }

    /**
     * Sort the stored values by the tenant's configured custom fields — the
     * same order the cashier fills in when registering, so the plate leads.
     * Left alone, the values come out in whatever order MySQL keyed the json
     * object, which differs row to row: a vehicle with no `brand` used to read
     * "Negro - Jeep - MBF3864" while its neighbour led with the brand.
     *
     * Keys the tenant hasn't configured (older rows, fields since removed) are
     * appended in their stored order rather than dropped.
     *
     * @param  array<string, mixed> $data
     * @return array<int, mixed>
     */
    private static function orderByTenantFields(array $data): array
    {
        $tenant = app()->has('current_tenant') ? app('current_tenant') : null;

        // ResolveTenantMiddleware binds a stdClass off the query builder rather
        // than an Eloquent model, so in a real request this is still raw json.
        $fields = $tenant?->custom_fields ?? null;
        if (is_string($fields)) {
            $fields = json_decode($fields, true);
        }
        if (!is_array($fields) || empty($fields)) {
            return array_values($data);
        }

        $ordered = [];
        foreach ($fields as $field) {
            $key = $field['key'] ?? null;
            if ($key !== null && array_key_exists($key, $data)) {
                $ordered[$key] = $data[$key];
            }
        }

        return array_values($ordered + $data);
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
