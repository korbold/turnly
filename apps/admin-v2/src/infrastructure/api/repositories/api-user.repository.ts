import type { CreateMemberInput, UserRepository } from '@/domain/repositories/user.repository';
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

    const { data: res } = await api.get('/users', { params });
    return mapPaginatedResponse(res, mapUser);
  }

  async getById(id: string): Promise<User> {
    const { data: res } = await api.get(`/users/${id}`);
    return mapUser(res.data);
  }

  async invite(input: CreateMemberInput): Promise<User> {
    const payload = {
      name: input.name,
      username: input.username,
      password: input.password,
      email: input.email || undefined,
      phone: input.phone || undefined,
      role: input.role,
    };
    const { data: res } = await api.post('/users/invite', payload);
    return mapUser(res.data.user ?? res.data);
  }

  async changeRole(id: string, role: UserRole): Promise<User> {
    const { data: res } = await api.patch(`/users/${id}/role`, { role });
    return mapUser(res.data);
  }

  async resetPassword(id: string, password: string): Promise<void> {
    await api.patch(`/users/${id}/password`, { password });
  }
}
