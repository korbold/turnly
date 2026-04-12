import axios from 'axios';

const publicApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1/public',
  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
});

export interface PublicTenant {
  name: string;
  slug: string;
  description: string | null;
  business_type: string;
  logo_url: string | null;
  cover_url: string | null;
  brand_theme: string;
  social_links: Record<string, string> | null;
  address: string | null;
  phone: string | null;
  custom_fields: Array<{ key: string; label: string; type: string; required: boolean; options?: string[] | null }> | null;
}

export interface PublicService {
  id: string;
  name: string;
  description: string | null;
  price: string;
  image_url: string | null;
}

export interface PublicAvailability {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface PublicImage {
  id: string;
  url: string;
  caption: string | null;
}

export interface AvailableSlot {
  start: string;
  end: string;
  available: number;
}

export async function getPublicTenant(slug: string) {
  const response = await publicApi.get(`/tenants/${slug}`);
  return response.data.data as {
    tenant: PublicTenant;
    services: PublicService[];
    availability: PublicAvailability[];
    images: PublicImage[];
  };
}

export async function getAvailableSlots(slug: string, serviceId: string, date: string) {
  const response = await publicApi.get(`/tenants/${slug}/available-slots`, {
    params: { service_id: serviceId, date },
  });
  return response.data.data as AvailableSlot[];
}

export async function bookAppointment(slug: string, data: {
  service_id: string;
  scheduled_at: string;
  client_name: string;
  client_email: string;
  client_phone?: string;
  notes?: string;
  client_resource_data?: Record<string, string>;
}) {
  const response = await publicApi.post(`/tenants/${slug}/book`, data);
  return response.data.data;
}
