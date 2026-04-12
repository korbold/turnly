import api from './client';

interface TenantImage {
  id: string;
  url: string;
  caption: string | null;
  sort_order: number;
}

export type { TenantImage };

export async function getTenantImages(): Promise<TenantImage[]> {
  const response = await api.get('/tenant/images');
  return response.data.data;
}

export async function addTenantImage(data: { url: string; caption?: string }): Promise<TenantImage> {
  const response = await api.post('/tenant/images', data);
  return response.data.data;
}

export async function deleteTenantImage(id: string): Promise<void> {
  await api.delete(`/tenant/images/${id}`);
}

export async function reorderTenantImages(ids: string[]): Promise<void> {
  await api.post('/tenant/images/reorder', { ids });
}
