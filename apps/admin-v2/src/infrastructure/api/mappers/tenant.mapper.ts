import type { Tenant, TenantSettings, TenantImage } from '@/domain/entities/tenant';

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
    plan: raw.plan as Tenant['plan'],
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
    themeColor: (raw.theme_color as string) ?? null,
    slotDuration: (raw.slot_duration as number) ?? 30,
    cancellationHours: (raw.cancellation_hours as number) ?? 2,
    socialLinks: {
      instagram: socialLinks.instagram ?? null,
      facebook: socialLinks.facebook ?? null,
      whatsapp: socialLinks.whatsapp ?? null,
    },
    customFields: (raw.custom_fields ?? raw.customFields ?? []) as TenantSettings['customFields'],
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
