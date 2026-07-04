<?php

declare(strict_types=1);

namespace App\Domain\Reservation;

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceVariantModel;
use Illuminate\Support\Collection;

/**
 * Picks the variant that fits a customer's `client_resource` best.
 *
 * The mechanism is declarative: tenants store a list of custom fields,
 * one of which can be flagged `affects_variant: true`. That field's `key`
 * is read from `resource.data` to obtain the segmentation value, which is
 * then matched by exact membership against `service_variants.vehicle_types`.
 * This keeps the engine vertical-agnostic — car_wash uses vehicle_type,
 * barbershop uses segment, médico uses patient_segment, etc.
 *
 * Returns null when:
 *   - The tenant has no segmentation field
 *   - The resource hasn't filled the segmentation value yet
 *   - No active variant's vehicle_types array contains the value
 */
final class VariantSuggester
{
    /**
     * @param Collection<int, ServiceVariantModel> $variants
     * @param array<int, array<string, mixed>> $customFields
     */
    public function suggest(
        ClientResourceModel $resource,
        Collection $variants,
        array $customFields,
    ): ?ServiceVariantModel {
        $field = collect($customFields)->first(
            fn (array $f) => ($f['affects_variant'] ?? false) === true,
        );
        if (!$field) return null;

        $key = $field['key'] ?? null;
        if (!$key) return null;

        $resourceData = $resource->data ?? [];
        if (!is_array($resourceData)) $resourceData = (array) $resourceData;

        $value = $resourceData[$key] ?? null;
        if (!is_string($value) || $value === '') return null;

        return $variants
            ->filter(fn ($v) => $v->is_active)
            ->sortBy('sort_order')
            ->first(function ($v) use ($value) {
                $types = $v->vehicle_types ?? [];
                return is_array($types) && in_array($value, $types, true);
            });
    }
}
