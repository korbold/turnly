import type { UserRepository } from '@/domain/repositories/user.repository';
import type { User, UserRole } from '@/domain/entities/user';
import type { PaginatedResult } from '@/shared/types/api';
import api from '../client';
import { mapUser } from '../mappers/user.mapper';
import { mapPaginatedResponse } from '../mappers/pagination';

export class ApiUserRepository implements UserRepository {
  async getAll(filters?: { role?: UserRole; excludeRole?: UserRole }): Promise<PaginatedResult<User>> {
    const params: Record<string, unknown> = {};
    if (filters?.role) params.role = filters.role;
    if (filters?.excludeRole) params.exclude_role = filters.excludeRole;

    const { data } = await api.get('/users', { params });
    return mapPaginatedResponse(data, mapUser);
  }

  async getById(id: string): Promise<User> {
    const { data } = await api.get(`/users/${id}`);
    return mapUser(data.data ?? data);
  }

  async invite(email: string, role: UserRole): Promise<User> {
    const { data } = await api.post('/users/invite', { email, role });
    return mapUser(data.data ?? data);
  }

  async changeRole(id: string, role: UserRole): Promise<User> {
    const { data } = await api.patch(`/users/${id}/role`, { role });
    return mapUser(data.data ?? data);
  }
}
