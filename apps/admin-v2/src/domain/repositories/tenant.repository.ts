import type { TenantSettings, TenantImage } from '../entities/tenant';

export interface TenantRepository {
  getSettings(): Promise<TenantSettings>;
  updateSettings(data: Partial<TenantSettings>): Promise<TenantSettings>;
  getImages(): Promise<TenantImage[]>;
  addImage(file: File): Promise<TenantImage>;
  deleteImage(id: string): Promise<void>;
  reorderImages(ids: string[]): Promise<void>;
}
