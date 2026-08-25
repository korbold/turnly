<?php
// apps/backend/app/Infrastructure/Http/Resources/CashSessionResource.php

namespace App\Infrastructure\Http\Resources;

use App\Application\Services\CashRegister;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * `expected_amount` y `difference` salen `null` mientras la caja está
 * abierta porque las columnas están vacías hasta el cierre. Eso ES el cierre
 * ciego: no hay nada que acordarse de ocultar. NO agregues acá un campo
 * calculado con el esperado.
 */
class CashSessionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'              => $this->id,
            'business_date'   => $this->business_date?->toDateString(),
            'status'          => $this->status,
            'opening_amount'  => (float) $this->opening_amount,
            'opened_at'       => $this->opened_at?->toIso8601String(),
            'opened_by'       => $this->opener
                ? ['id' => $this->opener->id, 'name' => $this->opener->name]
                : null,
            'closed_at'       => $this->closed_at?->toIso8601String(),
            'closed_by'       => $this->closer
                ? ['id' => $this->closer->id, 'name' => $this->closer->name]
                : null,
            'counted_amount'  => $this->counted_amount === null ? null : (float) $this->counted_amount,
            'expected_amount' => $this->expected_amount === null ? null : (float) $this->expected_amount,
            'difference'      => $this->difference === null ? null : (float) $this->difference,
            'notes'           => $this->notes,
            // Quién cobró cuánto efectivo, sólo con la caja ya cerrada:
            // sumar estas filas da el esperado, que es lo que el conteo
            // ciego oculta. Con la caja abierta va `null` por la misma
            // razón que `expected_amount`.
            'cash_by_person'  => $this->status === 'closed'
                ? app(CashRegister::class)->cashByPerson($this->resource)
                : null,
            'movements'       => CashMovementResource::collection(
                $this->relationLoaded('movements') ? $this->movements : collect()
            ),
        ];
    }
}
