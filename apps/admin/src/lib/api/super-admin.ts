import api from './client';

export interface SuperAdminTenant {
  id: string;
  slug: string;
  name: string;
  business_type: string;
  plan: string;
  status: string;
  email: string;
  phone: string | null;
  created_at: string;
}

export interface SuperAdminUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  is_super_admin: boolean;
  created_at: string;
  role?: string;
  tenants?: Array<{ id: string; name: string; slug: string }>;
}

export interface SystemStats {
  total_tenants: number;
  active_tenants: number;
  total_users: number;
  total_reservations: number;
  total_services: number;
}

export async function getStats(): Promise<SystemStats> {
  const response = await api.get('/superadmin/stats');
  return response.data.data;
}

export async function getTenants(params?: { per_page?: number }) {
  const response = await api.get('/superadmin/tenants', { params });
  return response.data;
}

export async function getUsers(params?: { per_page?: number }) {
  const response = await api.get('/superadmin/users', { params });
  return response.data;
}

export async function suspendTenant(id: string) {
  const response = await api.patch(`/superadmin/tenants/${id}/suspend`);
  return response.data;
}

export async function activateTenant(id: string) {
  const response = await api.patch(`/superadmin/tenants/${id}/activate`);
  return response.data;
}
