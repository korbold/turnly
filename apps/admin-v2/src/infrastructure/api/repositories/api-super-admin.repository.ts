import type { SuperAdminRepository, SuperAdminStats } from '@/domain/repositories/super-admin.repository';
import type { Tenant } from '@/domain/entities/tenant';
import type { User } from '@/domain/entities/user';
import type { PaginatedResult } from '@/shared/types/api';
import api from '../client';
import { mapTenant } from '../mappers/tenant.mapper';
import { mapUser } from '../mappers/user.mapper';
import { mapPaginatedResponse } from '../mappers/pagination';

function mapStats(raw: Record<string, unknown>): SuperAdminStats {
  return {
    totalTenants: (raw.total_tenants ?? raw.totalTenants) as number,
    activeTenants: (raw.active_tenants ?? raw.activeTenants) as number,
    totalUsers: (raw.total_users ?? raw.totalUsers) as number,
    totalReservations: (raw.total_reservations ?? raw.totalReservations) as number,
    totalServices: (raw.total_services ?? raw.totalServices) as number,
  };
}

export class ApiSuperAdminRepository implements SuperAdminRepository {
  async getStats(): Promise<SuperAdminStats> {
    const { data } = await api.get('/superadmin/stats');
    return mapStats(data.data ?? data);
  }

  async getTenants(page?: number): Promise<PaginatedResult<Tenant>> {
    const { data } = await api.get('/superadmin/tenants', { params: { page } });
    return mapPaginatedResponse(data, mapTenant);
  }

  async suspendTenant(id: string): Promise<Tenant> {
    const { data } = await api.patch(`/superadmin/tenants/${id}/suspend`);
    return mapTenant(data.data ?? data);
  }

  async activateTenant(id: string): Promise<Tenant> {
    const { data } = await api.patch(`/superadmin/tenants/${id}/activate`);
    return mapTenant(data.data ?? data);
  }

  async getUsers(page?: number): Promise<PaginatedResult<User>> {
    const { data } = await api.get('/superadmin/users', { params: { page } });
    return mapPaginatedResponse(data, mapUser);
  }
}
