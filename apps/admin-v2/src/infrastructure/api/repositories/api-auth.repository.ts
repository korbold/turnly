import type { AuthRepository, LoginResult } from '@/domain/repositories/auth.repository';
import api from '../client';
import { mapUser } from '../mappers/user.mapper';
import { mapTenant } from '../mappers/tenant.mapper';

export class ApiAuthRepository implements AuthRepository {
  async login(email: string, password: string): Promise<LoginResult> {
    const { data } = await api.post('/auth/login', { email, password });
    return {
      user: mapUser(data.user),
      token: data.token,
      tenant: data.tenant ? mapTenant(data.tenant) : null,
    };
  }

  async register(params: { name: string; email: string; password: string }): Promise<LoginResult> {
    const { data } = await api.post('/auth/register', params);
    return {
      user: mapUser(data.user),
      token: data.token,
      tenant: data.tenant ? mapTenant(data.tenant) : null,
    };
  }

  async logout(): Promise<void> {
    await api.post('/auth/logout');
  }

  async me(): Promise<{ user: import('@/domain/entities/user').User; tenant: import('@/domain/entities/tenant').Tenant | null }> {
    const { data } = await api.get('/auth/me');
    return {
      user: mapUser(data.user ?? data),
      tenant: data.tenant ? mapTenant(data.tenant) : null,
    };
  }
}
