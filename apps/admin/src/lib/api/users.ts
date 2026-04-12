import api from './client';
import type { User } from '@/types/user';
import type { PaginatedResponse } from '@/types/api';

export async function getUsers(params?: { per_page?: number }): Promise<PaginatedResponse<User>> {
  const response = await api.get('/users', { params });
  return response.data;
}

export async function updateUserRole(userId: string, role: string): Promise<void> {
  await api.patch(`/users/${userId}/role`, { role });
}
