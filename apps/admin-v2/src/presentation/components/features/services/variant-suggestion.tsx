'use client';

import { AlertTriangle } from 'lucide-react';
import type { ServiceVariant } from '@/domain/entities/service-variant';

/**
 * Suggests the variant that probably matches the vehicle currently
 * attached to a reservation, gated to car_wash tenants.
 *
 * Gating happens at the call site (`{businessType === 'car_wash' && ...}`)
 * so this component stays pure and tree-shakeable. Other verticals don't
 * have vehicles, so they should never render this.
 *
 * Mapping is intentionally fuzzy — the source-of-truth label is whatever
 * the tenant typed (e.g. "Mediano" or "Suv pequeño"), so we look for
 * keyword overlap with the vehicle size category.
 */
type Vehicle = { type?: string | null; brand?: string | null; model?: string | null } | null;

interface Props {
  vehicle: Vehicle;
  variants: ServiceVariant[];
  selectedVariantId: string | null;
  onApply: (variantId: string) => void;
}

const SIZE_BY_VEHICLE_TYPE: Record<string, string[]> = {
  // Small vehicles
  sedan:        ['pequeño', 'small', 'p', 'sedan'],
  hatchback:    ['pequeño', 'small', 'p', 'hatchback'],
  // Medium vehicles
  suv:          ['mediano', 'medium', 'm', 'suv'],
  // Large vehicles
  camioneta:    ['grande', 'large', 'g', 'camioneta', 'pickup'],
  pickup:       ['grande', 'large', 'g', 'pickup', 'camioneta'],
  truck:        ['grande', 'large', 'g', 'truck', 'camion'],
  van:          ['grande', 'large', 'g', 'van'],
};

function findSuggestedVariant(vehicle: Vehicle, variants: ServiceVariant[]): ServiceVariant | null {
  if (!vehicle?.type) return null;
  const keywords = SIZE_BY_VEHICLE_TYPE[vehicle.type.toLowerCase()];
  if (!keywords) return null;

  const lowerLabel = (v: ServiceVariant) => v.label.toLowerCase();
  return (
    variants.find((v) => v.isActive && keywords.some((k) => lowerLabel(v).includes(k))) ?? null
  );
}

export function VariantSuggestion({ vehicle, variants, selectedVariantId, onApply }: Props) {
  const suggested = findSuggestedVariant(vehicle, variants);
  if (!suggested || suggested.id === selectedVariantId) return null;

  const desc = [vehicle?.brand, vehicle?.model].filter(Boolean).join(' ') || 'tu vehículo';

  return (
    <div className="flex items-start gap-2 rounded-lg border border-[var(--warning-200)] bg-[var(--warning-50)]/60 p-3 text-[12.5px]">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning-700)]" />
      <div className="flex-1">
        <p className="font-medium text-[var(--fg-strong)]">
          Para {desc} sugerimos <strong>{suggested.label}</strong> (
          {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(suggested.price)}
          ).
        </p>
        <button
          type="button"
          onClick={() => onApply(suggested.id)}
          className="mt-1 text-[12px] font-semibold text-[var(--brand-700)] hover:underline"
        >
          Aplicar sugerencia
        </button>
      </div>
    </div>
  );
}
