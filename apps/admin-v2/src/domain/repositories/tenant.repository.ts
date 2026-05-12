import type {
  TenantSettings,
  TenantImage,
  BillingProfile,
  BillingProfileInput,
  SriLookupResult,
  TaxIdType,
} from '../entities/tenant';

export interface TenantRepository {
  getSettings(): Promise<TenantSettings>;
  updateSettings(data: Partial<TenantSettings>): Promise<TenantSettings>;
  getImages(): Promise<TenantImage[]>;
  addImage(file: File): Promise<TenantImage>;
  deleteImage(id: string): Promise<void>;
  reorderImages(ids: string[]): Promise<void>;
  getBillingProfile(): Promise<BillingProfile>;
  updateBillingProfile(input: BillingProfileInput): Promise<BillingProfile>;
  lookupTaxId(type: TaxIdType, taxId: string): Promise<SriLookupResult>;
}
