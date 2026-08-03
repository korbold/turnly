import type {
  AuthRepository,
  LoginResult,
  RegisterResult,
} from '@/domain/repositories/auth.repository';
import api from '../client';
import { mapUser } from '../mappers/user.mapper';
import { mapTenant } from '../mappers/tenant.mapper';

export class ApiAuthRepository implements AuthRepository {
  async login(identifier: string, password: string): Promise<LoginResult> {
    const trimmed = identifier.trim();
    const isEmail = trimmed.includes('@');
    const payload = isEmail
      ? { email: trimmed, password }
      : { identifier: trimmed, password };
    const { data: res } = await api.post('/auth/login', payload);
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
  }): Promise<RegisterResult> {
    const { data: res } = await api.post('/auth/register', {
      name: params.name,
      email: params.email,
      password: params.password,
      business_name: params.businessName,
      business_type: params.businessType,
      // honeypot — must remain empty
      website: '',
    });
    const d = res.data;
    return {
      user: mapUser(d.user),
      token: d.token,
      tenant: d.tenant ? mapTenant(d.tenant) : null,
      emailVerified: Boolean(d.user?.email_verified),
    };
  }

  async verifyEmail(email: string, code: string): Promise<LoginResult> {
    const { data: res } = await api.post('/auth/verify-email', { email, code });
    const d = res.data;
    return {
      user: mapUser(d.user),
      token: d.token,
      tenant: d.tenant ? mapTenant(d.tenant) : null,
    };
  }

  async resendVerification(email: string): Promise<void> {
    await api.post('/auth/verify-email/resend', { email });
  }

  async requestPasswordReset(email: string): Promise<void> {
    await api.post('/auth/password/forgot', { email });
  }

  async resetPassword(input: { email: string; token: string; password: string }): Promise<void> {
    await api.post('/auth/password/reset', input);
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
