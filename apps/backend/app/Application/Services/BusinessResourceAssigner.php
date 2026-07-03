<?php

namespace App\Application\Services;

use App\Domain\BusinessResource\Exceptions\NoResourceAvailableException;
use App\Infrastructure\Persistence\Models\BusinessResourceModel;
use App\Infrastructure\Persistence\Models\ReservationModel;

class BusinessResourceAssigner
{
    /**
     * Determine the business_resource_id for a new reservation.
     *
     * Returns null when the tenant has no active resources (feature not in use).
     * Throws NoResourceAvailableException when resources exist but none is free.
     */
    public function assign(
        string $tenantId,
        array $tenantSettings,
        \DateTimeImmutable $scheduledAt,
        \DateTimeImmutable $estimatedEnd,
        ?string $clientSelectedResourceId,
    ): ?string {
        $activeResources = BusinessResourceModel::where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        if ($activeResources->isEmpty()) {
            return null;
        }

        $allowClientSelection = (bool) ($tenantSettings['allow_client_resource_selection'] ?? false);

        if (!$allowClientSelection) {
            $assigned = $activeResources->first(function ($resource) use ($scheduledAt, $estimatedEnd) {
                return !ReservationModel::where('business_resource_id', $resource->id)
                    ->where('scheduled_at', '<', $estimatedEnd->format('Y-m-d H:i:s'))
                    ->where('estimated_end', '>', $scheduledAt->format('Y-m-d H:i:s'))
                    ->whereNotIn('status', ['cancelled', 'no_show'])
                    ->exists();
            });

            if (!$assigned) {
                throw new NoResourceAvailableException();
            }

            return $assigned->id;
        }

        if ($clientSelectedResourceId !== null) {
            $alreadyBooked = ReservationModel::where('business_resource_id', $clientSelectedResourceId)
                ->where('scheduled_at', '<', $estimatedEnd->format('Y-m-d H:i:s'))
                ->where('estimated_end', '>', $scheduledAt->format('Y-m-d H:i:s'))
                ->whereNotIn('status', ['cancelled', 'no_show'])
                ->exists();

            if ($alreadyBooked) {
                throw new NoResourceAvailableException();
            }
        }

        return $clientSelectedResourceId;
    }
}
