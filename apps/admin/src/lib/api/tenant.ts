import api from './client';

export async function getTenantSettings() {
  const response = await api.get('/tenant/settings');
  return response.data.data;
}

export async function updateTenantSettings(data: {
  name?: string;
  description?: string;
  address?: string;
  phone?: string;
  business_type?: string;
  custom_fields?: Array<{ key: string; label: string; type: string; required: boolean; options?: string[] | null }>;
  social_links?: Record<string, string>;
  brand_theme?: string;
  logo_url?: string;
  cover_url?: string;
  settings?: Record<string, unknown>;
  onboarding_step?: number;
}) {
  const response = await api.patch('/tenant/settings', data);
  return response.data.data;
}
