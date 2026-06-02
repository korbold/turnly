<?php

declare(strict_types=1);

namespace App\Infrastructure\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StockMovementResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'         => $this->id,
            'product_id' => $this->product_id,
            'type'       => $this->type,
            'qty'        => (float) $this->qty,
            'unit_cost'  => (float) $this->unit_cost,
            'ref_type'   => $this->ref_type,
            'ref_id'     => $this->ref_id,
            'user'       => $this->whenLoaded('user', fn () => $this->user ? [
                'id'   => $this->user->id,
                'name' => $this->user->name,
            ] : null),
            'note'       => $this->note,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
