import type { AvailableSlot } from '../entities/reservation';

export interface PublicTenant {
  name: string;
  description: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  themeColor: string | null;
  socialLinks: { instagram: string | null; facebook: string | null; whatsapp: string | null };
  address: string | null;
  phone: string | null;
  services: Array<{ id: string; name: string; price: string; imageUrl: string | null; description: string | null }>;
  customFields: Array<{ key: string; label: string; type: string; required: boolean; options?: string[] }>;
}

export interface BookingData {
  serviceId: string;
  scheduledAt: string;
  name: string;
  phone: string;
  resourceData: Record<string, unknown>;
}

export interface PublicRepository {
  getTenantBySlug(slug: string): Promise<PublicTenant>;
  getAvailableSlots(slug: string, serviceId: string, date: string): Promise<AvailableSlot[]>;
  book(slug: string, data: BookingData): Promise<{ reservationId: string }>;
}
