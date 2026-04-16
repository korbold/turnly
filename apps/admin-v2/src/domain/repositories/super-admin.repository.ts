import type { Tenant } from '../entities/tenant';
import type { User } from '../entities/user';
import type { PaginatedResult } from '../../shared/types/api';

export interface SuperAdminStats {
  totalTenants: number;
  activeTenants: number;
  totalUsers: number;
  totalReservations: number;
  totalServices: number;
}

export interface SuperAdminRepository {
  getStats(): Promise<SuperAdminStats>;
  getTenants(page?: number): Promise<PaginatedResult<Tenant>>;
  suspendTenant(id: string): Promise<Tenant>;
  activateTenant(id: string): Promise<Tenant>;
  getUsers(page?: number): Promise<PaginatedResult<User>>;
}
