import type { Tenant, BusinessType } from '../entities/tenant';

export interface RegisterTenantData {
  businessName: string;
  ownerName: string;
  email: string;
  password: string;
}

export interface OnboardingRepository {
  register(data: RegisterTenantData): Promise<{ token: string; tenant: Tenant }>;
  verify(code: string): Promise<void>;
  checkSlug(slug: string): Promise<{ available: boolean }>;
  setBusinessType(type: BusinessType, createServices: boolean): Promise<void>;
}
