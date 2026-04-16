import type { TenantRepository } from '@/domain/repositories/tenant.repository';
import type { TenantSettings, TenantImage } from '@/domain/entities/tenant';
import api from '../client';
import { mapTenantSettings, mapTenantImage } from '../mappers/tenant.mapper';

export class ApiTenantRepository implements TenantRepository {
  async getSettings(): Promise<TenantSettings> {
    const { data } = await api.get('/tenant/settings');
    return mapTenantSettings(data.data ?? data);
  }

  async updateSettings(settings: Partial<TenantSettings>): Promise<TenantSettings> {
    const body: Record<string, unknown> = {};
    if (settings.name !== undefined) body.name = settings.name;
    if (settings.description !== undefined) body.description = settings.description;
    if (settings.address !== undefined) body.address = settings.address;
    if (settings.phone !== undefined) body.phone = settings.phone;
    if (settings.logoUrl !== undefined) body.logo_url = settings.logoUrl;
    if (settings.coverUrl !== undefined) body.cover_url = settings.coverUrl;
    if (settings.themeColor !== undefined) body.theme_color = settings.themeColor;
    if (settings.slotDuration !== undefined) body.slot_duration = settings.slotDuration;
    if (settings.cancellationHours !== undefined) body.cancellation_hours = settings.cancellationHours;
    if (settings.socialLinks !== undefined) body.social_links = settings.socialLinks;
    if (settings.customFields !== undefined) body.custom_fields = settings.customFields;
    if (settings.businessType !== undefined) body.business_type = settings.businessType;
    if (settings.permissions !== undefined) body.permissions = settings.permissions;

    const { data } = await api.patch('/tenant/settings', body);
    return mapTenantSettings(data.data ?? data);
  }

  async getImages(): Promise<TenantImage[]> {
    const { data } = await api.get('/tenant/images');
    const images = data.data ?? data;
    return (images as Record<string, unknown>[]).map(mapTenantImage);
  }

  async addImage(file: File): Promise<TenantImage> {
    const formData = new FormData();
    formData.append('image', file);

    const { data } = await api.post('/tenant/images', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return mapTenantImage(data.data ?? data);
  }

  async deleteImage(id: string): Promise<void> {
    await api.delete(`/tenant/images/${id}`);
  }

  async reorderImages(ids: string[]): Promise<void> {
    await api.post('/tenant/images/reorder', { ids });
  }
}
