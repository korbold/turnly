<?php

namespace App\Infrastructure\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PlanResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                         => $this->id,
            'name'                       => $this->name,
            'slug'                       => $this->slug,
            'price'                      => (float) $this->price,
            'max_services'               => $this->max_services,
            'max_reservations_per_month' => $this->max_reservations_per_month,
            'max_employees'              => $this->max_employees,
            'has_push_notifications'     => (bool) $this->has_push_notifications,
            'has_reports'                => (bool) $this->has_reports,
            'has_reminders'              => (bool) $this->has_reminders,
            'has_custom_page'            => (bool) $this->has_custom_page,
            'is_active'                  => (bool) $this->is_active,
            'sort_order'                 => $this->sort_order,
            'description'                => $this->description,
            'tenants_count'              => $this->whenCounted('tenants'),
            'created_at'                 => $this->created_at?->toIso8601String(),
        ];
    }
}
