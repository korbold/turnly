<?php

declare(strict_types=1);

namespace App\Infrastructure\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $level = $this->relationLoaded('stockLevel') ? $this->stockLevel : null;

        return [
            'id'          => $this->id,
            'sku'         => $this->sku,
            'name'        => $this->name,
            'description' => $this->description,
            'type'        => $this->type,
            'unit'        => $this->unit,
            'cost'        => (float) $this->cost,
            'price'       => (float) $this->price,
            'tax_rate'    => (float) $this->tax_rate,
            'stock_min'   => (float) $this->stock_min,
            'is_active'   => (bool) $this->is_active,
            'stock'       => $level ? [
                'on_hand'  => (float) $level->on_hand,
                'reserved' => (float) $level->reserved,
                'avg_cost' => (float) $level->avg_cost,
                'low'      => (float) $level->on_hand <= (float) $this->stock_min,
            ] : null,
            'created_at'  => $this->created_at?->toIso8601String(),
            'updated_at'  => $this->updated_at?->toIso8601String(),
        ];
    }
}
