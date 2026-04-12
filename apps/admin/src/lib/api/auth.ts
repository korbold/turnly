import api from './client';

interface LoginResponse {
  data: {
    user: { id: string; name: string; email: string };
    token: string;
    tenant?: { id: string; slug: string; name: string } | null;
  };
}

interface RegisterResponse {
  data: {
    user: { id: string; name: string; email: string };
    token: string;
  };
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('/auth/login', { email, password });
  const { token, tenant } = response.data.data;
  localStorage.setItem('auth_token', token);
  if (tenant?.slug) {
    localStorage.setItem('tenant_slug', tenant.slug);
  }
  return response.data;
}

export async function register(data: {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  phone?: string;
}): Promise<RegisterResponse> {
  const response = await api.post<RegisterResponse>('/auth/register', data);
  const { token } = response.data.data;
  localStorage.setItem('auth_token', token);
  return response.data;
}

export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout');
  } finally {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('tenant_slug');
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

export function isAuthenticated(): boolean {
  return getToken() !== null;
}
