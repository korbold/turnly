<?php

declare(strict_types=1);

namespace App\Domain\Reservation;

use App\Infrastructure\Persistence\Models\ClientResourceModel;
use App\Infrastructure\Persistence\Models\ServiceVariantModel;
use Illuminate\Support\Collection;

/**
 * Picks the variant that fits a customer's `client_resource` best.
 *
 * The mechanism is declarative: tenants store a list of custom fields
 * (see BusinessTypeTemplates), one of which can be flagged
 * `affects_variant: true` and carry a `variant_map` of value→keywords.
 * That keeps the engine vertical-agnostic — car_wash uses vehicle_type,
 * barbershop uses segment, médico uses patient_segment, etc.
 *
 * Returns null when:
 *   - The tenant has no segmentation field
 *   - The resource hasn't filled the segmentation value yet
 *   - No variant label matches any of the keywords
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
        $variantMap = $field['variant_map'] ?? [];
        if (!$key || empty($variantMap)) return null;

        $resourceData = $resource->data ?? [];
        if (!is_array($resourceData)) $resourceData = (array) $resourceData;

        $value = $resourceData[$key] ?? null;
        if (!is_string($value) || $value === '') return null;

        $keywords = $variantMap[$value] ?? null;
        if (!is_array($keywords) || empty($keywords)) return null;

        // Keywords are listed in specificity order ("camioneta" before
        // the more generic "grande"). Walk through them and return the
        // first active variant whose label contains the keyword. That
        // way an exact size match wins over a coarser bucket name.
        $activeVariants = $variants->filter(fn ($v) => $v->is_active);

        foreach ($keywords as $kw) {
            $needle = mb_strtolower((string) $kw);
            if ($needle === '') continue;
            foreach ($activeVariants as $variant) {
                if (str_contains(mb_strtolower($variant->label), $needle)) {
                    return $variant;
                }
            }
        }

        return null;
    }
}
