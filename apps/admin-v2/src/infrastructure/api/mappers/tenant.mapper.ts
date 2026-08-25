import type { Tenant, TenantSettings, TenantImage } from '@/domain/entities/tenant';
import { mapPlanSummary } from './plan.mapper';

export function mapTenant(raw: Record<string, unknown>): Tenant {
  return {
    id: raw.id as string,
    slug: raw.slug as string,
    name: raw.name as string,
    ownerName: raw.owner_name as string,
    email: raw.email as string,
    phone: (raw.phone as string) ?? null,
    city: (raw.city as string) ?? null,
    country: (raw.country as string) ?? 'CO',
    businessType: (raw.business_type as Tenant['businessType']) ?? null,
    planId: (raw.plan_id as string) ?? null,
    isTrial: (raw.is_trial as boolean) ?? false,
    plan: raw.plan ? mapPlanSummary(raw.plan as Record<string, unknown>) : null,
    status: raw.status as Tenant['status'],
    trialEndsAt: raw.trial_ends_at ? new Date(raw.trial_ends_at as string) : null,
    onboardingStep: (raw.onboarding_step as number) ?? 0,
    activatedAt: raw.activated_at ? new Date(raw.activated_at as string) : null,
    createdAt: new Date(raw.created_at as string),
  };
}

export function mapTenantSettings(raw: Record<string, unknown>): TenantSettings {
  const socialLinks = (raw.social_links ?? raw.socialLinks ?? {}) as Record<string, string | null>;
  return {
    name: raw.name as string,
    slug: raw.slug as string,
    businessType: (raw.business_type as TenantSettings['businessType']) ?? null,
    description: (raw.description as string) ?? null,
    address: (raw.address as string) ?? null,
    phone: (raw.phone as string) ?? null,
    logoUrl: (raw.logo_url as string) ?? null,
    coverUrl: (raw.cover_url as string) ?? null,
    themeColor: (raw.brand_theme as string) ?? (raw.theme_color as string) ?? null,
    slotDuration: (raw.slot_duration as number) ?? 30,
    cancellationHours: (raw.cancellation_hours as number) ?? 2,
    defaultTaxRate: Number(raw.default_tax_rate ?? 15),
    paymentTiming: (raw.payment_timing as TenantSettings['paymentTiming']) ?? 'flexible',
    autoConfirmReservations: Boolean(raw.auto_confirm_reservations ?? false),
    allowClientResourceSelection: Boolean(raw.allow_client_resource_selection ?? false),
    ivaMode: (raw.iva_mode as TenantSettings['ivaMode']) ?? 'excluded',
    requireOpenTillForCash: Boolean(raw.require_open_till_for_cash ?? false),
    socialLinks: {
      instagram: socialLinks.instagram ?? null,
      facebook: socialLinks.facebook ?? null,
      whatsapp: socialLinks.whatsapp ?? null,
      maps_url: socialLinks.maps_url ?? null,
    },
    customFields: ((raw.custom_fields ?? raw.customFields ?? []) as Record<string, unknown>[]).map((cf) => ({
      key: cf.key as string,
      label: cf.label as string,
      type: cf.type as import('@/domain/entities/tenant').CustomField['type'],
      required: Boolean(cf.required),
      options: (cf.options as string[] | undefined) ?? undefined,
      capitalize: cf.capitalize as import('@/domain/entities/tenant').CustomField['capitalize'] | undefined,
      affectsVariant: (cf.affects_variant ?? cf.affectsVariant) ? true : undefined,
      locked: cf.locked ? true : undefined,
    })),
    permissions: (raw.permissions ?? {}) as Record<string, Record<string, string>>,
  };
}

export function mapTenantImage(raw: Record<string, unknown>): TenantImage {
  return {
    id: raw.id as string,
    url: raw.url as string,
    sortOrder: (raw.sort_order as number) ?? 0,
  };
}
