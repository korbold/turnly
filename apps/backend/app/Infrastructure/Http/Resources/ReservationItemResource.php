<?php

declare(strict_types=1);

namespace App\Infrastructure\Http\Resources;

use App\Infrastructure\Persistence\Models\ServiceVariantModel;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ReservationItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        // For service_variant rows the staff editor needs the parent
        // service_id so it can offer the sibling variants (Pequeño /
        // Mediano / Grande / Camioneta, etc.) without an extra round
        // trip. Loaded lazily — if the relationship wasn't eager-loaded
        // upstream, the resolver falls back to the table lookup.
        $serviceId = null;
        if ($this->item_type === 'service_variant' && $this->ref_id) {
            $serviceId = ServiceVariantModel::query()
                ->whereKey($this->ref_id)
                ->value('service_id');
        }

        return [
            'id'             => $this->id,
            'reservation_id' => $this->reservation_id,
            'item_type'      => $this->item_type,
            'ref_id'         => $this->ref_id,
            'service_id'     => $serviceId,
            'label'          => $this->label,
            'qty'            => (float) $this->qty,
            'unit_price'     => (float) $this->unit_price,
            'line_total'     => (float) $this->line_total,
            'sort_order'     => (int) $this->sort_order,
            'created_at'     => $this->created_at?->toIso8601String(),
        ];
    }
}
