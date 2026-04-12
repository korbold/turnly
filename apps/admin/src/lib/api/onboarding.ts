import api from './client';

export async function registerTenant(data: {
  name: string;
  slug: string;
  owner_name: string;
  email: string;
  password: string;
  phone?: string;
  city?: string;
  country?: string;
}) {
  const response = await api.post('/onboarding/register', data);
  const { token } = response.data.data;
  if (token) {
    localStorage.setItem('auth_token', token);
  }
  return response.data;
}

export async function verifyTenant(tenantId: string) {
  const response = await api.post('/onboarding/verify', { tenant_id: tenantId });
  return response.data;
}

export async function checkSlug(slug: string): Promise<boolean> {
  const response = await api.get('/onboarding/check-slug', { params: { slug } });
  return response.data.data.available;
}
