import type { PublicRepository, PublicTenant, BookingData } from '@/domain/repositories/public.repository';
import type { AvailableSlot } from '@/domain/entities/reservation';
import { mapAvailableSlot } from '../mappers/reservation.mapper';
import api from '../client';

function mapPublicTenant(raw: Record<string, unknown>): PublicTenant {
  // Backend returns { tenant: {...}, services: [...] } at /public/tenants/{slug}.
  // Older shape (flat) kept as fallback so listings or future endpoints keep working.
  const tenant = (raw.tenant as Record<string, unknown> | undefined) ?? raw;
  const services = (raw.services ?? tenant.services ?? []) as Record<string, unknown>[];
  const socialLinks = (tenant.social_links ?? {}) as Record<string, string | null>;
  return {
    name: tenant.name as string,
    description: (tenant.description as string) ?? null,
    logoUrl: (tenant.logo_url as string) ?? null,
    coverUrl: (tenant.cover_url as string) ?? null,
    themeColor:
      (tenant.brand_theme as string) ?? (tenant.theme_color as string) ?? null,
    socialLinks: {
      instagram: socialLinks.instagram ?? null,
      facebook: socialLinks.facebook ?? null,
      whatsapp: socialLinks.whatsapp ?? null,
    },
    address: (tenant.address as string) ?? null,
    phone: (tenant.phone as string) ?? null,
    services: services.map((s) => ({
      id: s.id as string,
      name: s.name as string,
      price: String(s.price),
      imageUrl: (s.image_url as string) ?? null,
      description: (s.description as string) ?? null,
    })),
    customFields: ((tenant.custom_fields ?? []) as Record<string, unknown>[]).map((f) => ({
      key: f.key as string,
      label: f.label as string,
      type: f.type as string,
      required: f.required as boolean,
      options: f.options as string[] | undefined,
    })),
  };
}

export class ApiPublicRepository implements PublicRepository {
  async getTenantBySlug(slug: string): Promise<PublicTenant> {
    const { data: res } = await api.get(`/public/tenants/${slug}`);
    return mapPublicTenant(res.data);
  }

  async getAvailableSlots(slug: string, serviceId: string, date: string): Promise<AvailableSlot[]> {
    const { data: res } = await api.get(`/public/tenants/${slug}/available-slots`, {
      params: { service_id: serviceId, date },
    });
    return (res.data as Record<string, unknown>[]).map(mapAvailableSlot);
  }

  async book(slug: string, bookingData: BookingData): Promise<{ reservationId: string }> {
    const { data: res } = await api.post(`/public/tenants/${slug}/book`, {
      service_id: bookingData.serviceId,
      scheduled_at: bookingData.scheduledAt,
      name: bookingData.name,
      phone: bookingData.phone,
      resource_data: bookingData.resourceData,
    });
    const d = res.data;
    return { reservationId: (d.reservation_id ?? d.id) as string };
  }
}
