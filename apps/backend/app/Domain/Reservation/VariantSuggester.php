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
        $data = $resource->data ?? [];

        return $this->suggestFromData(is_array($data) ? $data : (array) $data, $variants, $customFields);
    }

    /**
     * Same rule, applied to raw field values instead of a saved resource.
     *
     * A guest booking on the web types the vehicle data in the form; the
     * resource row only exists after the reservation is created, so the
     * price has to be resolved from what was typed.
     *
     * @param array<string, mixed> $resourceData
     * @param Collection<int, ServiceVariantModel> $variants
     * @param array<int, array<string, mixed>> $customFields
     */
    public function suggestFromData(
        array $resourceData,
        Collection $variants,
        array $customFields,
    ): ?ServiceVariantModel {
        $field = collect($customFields)->first(
            fn (array $f) => ($f['affects_variant'] ?? false) === true,
        );

        $value = null;

        if ($field && ($key = $field['key'] ?? null)) {
            $candidate = $resourceData[$key] ?? null;
            $value = is_string($candidate) && $candidate !== '' ? $candidate : null;
        }

        // Not every tenant remembered to flag the field, yet its variants
        // still declare the types they serve. Rather than silently
        // charging the default price, match any answer that a variant
        // claims. Explicit configuration still wins.
        if ($value === null) {
            $declared = $variants
                ->filter(fn ($v) => $v->is_active)
                ->flatMap(fn ($v) => is_array($v->vehicle_types) ? $v->vehicle_types : [])
                ->unique();

            foreach ($resourceData as $candidate) {
                if (is_string($candidate) && $candidate !== '' && $declared->contains($candidate)) {
                    $value = $candidate;
                    break;
                }
            }
        }

        if ($value === null) return null;

        return $variants
            ->filter(fn ($v) => $v->is_active)
            ->sortBy('sort_order')
            ->first(function ($v) use ($value) {
                $types = $v->vehicle_types ?? [];
                return is_array($types) && in_array($value, $types, true);
            });
    }
}
