import type { PublicRepository, PublicTenant, BookingData } from '@/domain/repositories/public.repository';
import type { AvailableSlot } from '@/domain/entities/reservation';
import { mapAvailableSlot } from '../mappers/reservation.mapper';
import api from '../client';

function mapPublicTenant(raw: Record<string, unknown>): PublicTenant {
  const socialLinks = (raw.social_links ?? {}) as Record<string, string | null>;
  return {
    name: raw.name as string,
    description: (raw.description as string) ?? null,
    logoUrl: (raw.logo_url as string) ?? null,
    coverUrl: (raw.cover_url as string) ?? null,
    themeColor: (raw.theme_color as string) ?? null,
    socialLinks: {
      instagram: socialLinks.instagram ?? null,
      facebook: socialLinks.facebook ?? null,
      whatsapp: socialLinks.whatsapp ?? null,
    },
    address: (raw.address as string) ?? null,
    phone: (raw.phone as string) ?? null,
    services: ((raw.services ?? []) as Record<string, unknown>[]).map((s) => ({
      id: s.id as string,
      name: s.name as string,
      price: String(s.price),
      imageUrl: (s.image_url as string) ?? null,
      description: (s.description as string) ?? null,
    })),
    customFields: ((raw.custom_fields ?? []) as Record<string, unknown>[]).map((f) => ({
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
