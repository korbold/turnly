import type { BusinessType } from '@/domain/entities/tenant';

/**
 * The `washer` role is the person who performs the service. Its backend
 * code and its permissions-matrix key stay fixed — renaming either would
 * break stored tenant settings — but what the staff member is *called*
 * depends on the trade.
 */
export const WASHER_LABEL_BY_BUSINESS: Partial<Record<BusinessType, string>> = {
  car_wash: 'Lavador',
  barbershop: 'Barbero',
  spa: 'Terapeuta',
  medical: 'Asistente',
  gym: 'Entrenador',
  other: 'Operario',
};

/** Falls back to the trade-neutral "Operario" for unknown/unset types. */
export function washerLabel(businessType: BusinessType | null | undefined): string {
  return (businessType && WASHER_LABEL_BY_BUSINESS[businessType]) || 'Operario';
}
