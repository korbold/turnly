import type { OnboardingRepository, RegisterTenantData } from '@/domain/repositories/onboarding.repository';
import type { Tenant, BusinessType } from '@/domain/entities/tenant';
import api from '../client';
import { mapTenant } from '../mappers/tenant.mapper';

export class ApiOnboardingRepository implements OnboardingRepository {
  async register(data: RegisterTenantData): Promise<{ token: string; tenant: Tenant }> {
    const { data: res } = await api.post('/onboarding/register', {
      business_name: data.businessName,
      owner_name: data.ownerName,
      email: data.email,
      password: data.password,
    });
    return { token: res.token, tenant: mapTenant(res.tenant) };
  }

  async verify(code: string): Promise<void> {
    await api.post('/onboarding/verify', { code });
  }

  async checkSlug(slug: string): Promise<{ available: boolean }> {
    const { data } = await api.get('/onboarding/check-slug', { params: { slug } });
    return { available: data.available };
  }

  async setBusinessType(type: BusinessType, createServices: boolean): Promise<void> {
    await api.post('/onboarding/business-type', {
      business_type: type,
      create_services: createServices,
    });
  }
}
