import type { AuthRepository, LoginResult } from '@/domain/repositories/auth.repository';
import api from '../client';
import { mapUser } from '../mappers/user.mapper';
import { mapTenant } from '../mappers/tenant.mapper';

export class ApiAuthRepository implements AuthRepository {
  async login(email: string, password: string): Promise<LoginResult> {
    const { data: res } = await api.post('/auth/login', { email, password });
    const d = res.data;
    return {
      user: mapUser(d.user),
      token: d.token,
      tenant: d.tenant ? mapTenant(d.tenant) : null,
    };
  }

  async register(params: {
    name: string;
    email: string;
    password: string;
    businessName?: string;
    businessType?: string;
  }): Promise<LoginResult> {
    const { data: res } = await api.post('/auth/register', {
      name: params.name,
      email: params.email,
      password: params.password,
      business_name: params.businessName,
      business_type: params.businessType,
    });
    const d = res.data;
    return {
      user: mapUser(d.user),
      token: d.token,
      tenant: d.tenant ? mapTenant(d.tenant) : null,
    };
  }

  async logout(): Promise<void> {
    await api.post('/auth/logout');
  }

  async me(): Promise<{ user: import('@/domain/entities/user').User; tenant: import('@/domain/entities/tenant').Tenant | null }> {
    const { data: res } = await api.get('/auth/me');
    const d = res.data;
    return {
      user: mapUser(d.user ?? d),
      tenant: d.tenant ? mapTenant(d.tenant) : null,
    };
  }
}
