import api from './client';

export async function getTenantSettings() {
  const response = await api.get('/tenant/settings');
  return response.data.data;
}

export async function updateTenantSettings(data: {
  settings?: Record<string, unknown>;
  onboarding_step?: number;
}) {
  const response = await api.patch('/tenant/settings', data);
  return response.data.data;
}
