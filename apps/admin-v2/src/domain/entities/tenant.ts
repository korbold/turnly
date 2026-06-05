import type { PlanSummary } from './plan';
export type TenantStatus = 'pending' | 'active' | 'suspended' | 'cancelled';
export type BusinessType = 'car_wash' | 'barbershop' | 'medical' | 'spa' | 'gym' | 'other';

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  ownerName: string;
  email: string;
  phone: string | null;
  city: string | null;
  country: string;
  businessType: BusinessType | null;
  planId: string | null;
  isTrial: boolean;
  plan: PlanSummary | null;
  status: TenantStatus;
  trialEndsAt: Date | null;
  onboardingStep: number;
  activatedAt: Date | null;
  createdAt: Date;
}

export interface TenantSettings {
  name: string;
  slug: string;
  businessType: BusinessType | null;
  description: string | null;
  address: string | null;
  phone: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  themeColor: string | null;
  slotDuration: number;
  cancellationHours: number;
  defaultTaxRate: number;
  /** When the staff captures payment in the lifecycle. Drives where the
      "Registrar pago" CTA appears in the admin and whether the customer
      app shows a prepay checkout step. */
  paymentTiming: 'prepay_required' | 'at_pickup' | 'at_completion' | 'flexible' | 'none';
  /** When true, new public bookings land as `confirmed` instead of
      `pending`, skipping the manual review step in the dashboard.
      Useful for high-volume tenants (car wash, lavandería). */
  autoConfirmReservations: boolean;
  socialLinks: {
    instagram: string | null;
    facebook: string | null;
    whatsapp: string | null;
    maps_url: string | null;
  };
  customFields: CustomField[];
  permissions: Record<string, Record<string, string>>;
}

export interface CustomField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'textarea';
  required: boolean;
  options?: string[];
  capitalize?: 'none' | 'uppercase' | 'capitalize' | 'lowercase';
}

export interface TenantImage {
  id: string;
  url: string;
  sortOrder: number;
}

export type TaxIdType = 'ruc' | 'cedula' | 'pasaporte';

export interface BillingProfile {
  taxIdType: TaxIdType | null;
  taxId: string | null;
  legalName: string | null;
  billingEmail: string | null;
  billingAddress: string | null;
  billingPhone: string | null;
  billingVerified: boolean;
  billingVerifiedAt: Date | null;
}

export interface BillingProfileInput {
  taxIdType: TaxIdType;
  taxId: string;
  legalName: string;
  billingEmail: string;
  billingAddress: string;
  billingPhone?: string | null;
}

export interface SriLookupResult {
  formatValid: boolean;
  lookup: {
    razonSocial: string;
    estado: string;
    tipoIdentificacion: string;
  } | null;
}
