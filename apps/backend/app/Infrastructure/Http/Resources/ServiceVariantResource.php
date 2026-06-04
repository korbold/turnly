<?php

declare(strict_types=1);

namespace App\Infrastructure\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ServiceVariantResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'           => $this->id,
            'service_id'   => $this->service_id,
            'label'        => $this->label,
            'price'        => (float) $this->price,
            'duration_min' => (int) $this->duration_min,
            'sort_order'   => (int) $this->sort_order,
            'is_active'    => (bool) $this->is_active,
            'consumption'  => $this->whenLoaded('consumption', fn () =>
                $this->consumption->map(fn ($line) => [
                    'id'         => $line->id,
                    'product_id' => $line->product_id,
                    'product'    => $line->relationLoaded('product') && $line->product ? [
                        'id'   => $line->product->id,
                        'name' => $line->product->name,
                        'unit' => $line->product->unit,
                    ] : null,
                    'qty'        => (float) $line->qty,
                ])->all(),
            ),
            'created_at'   => $this->created_at?->toIso8601String(),
            'updated_at'   => $this->updated_at?->toIso8601String(),
        ];
    }
}
