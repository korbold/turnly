<?php

declare(strict_types=1);

namespace App\Infrastructure\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ReservationItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'             => $this->id,
            'reservation_id' => $this->reservation_id,
            'item_type'      => $this->item_type,
            'ref_id'         => $this->ref_id,
            'label'          => $this->label,
            'qty'            => (float) $this->qty,
            'unit_price'     => (float) $this->unit_price,
            'line_total'     => (float) $this->line_total,
            'sort_order'     => (int) $this->sort_order,
            'created_at'     => $this->created_at?->toIso8601String(),
        ];
    }
}
