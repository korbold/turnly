<?php
// apps/backend/app/Infrastructure/Http/Resources/CashMovementResource.php

namespace App\Infrastructure\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CashMovementResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'         => $this->id,
            'type'       => $this->type,
            'amount'     => (float) $this->amount,
            'reason'     => $this->reason,
            'created_at' => $this->created_at?->toIso8601String(),
            'created_by' => $this->author
                ? ['id' => $this->author->id, 'name' => $this->author->name]
                : null,
        ];
    }
}
