import api from './client';
import type { User } from '@/types/user';
import type { PaginatedResponse } from '@/types/api';

export async function getUsers(params?: { per_page?: number; role?: string }): Promise<PaginatedResponse<User>> {
  const response = await api.get('/users', { params });
  return response.data;
}

export async function updateUserRole(userId: string, role: string): Promise<void> {
  await api.patch(`/users/${userId}/role`, { role });
}

export async function inviteUser(data: {
  name: string;
  email: string;
  password: string;
  role: string;
  phone?: string;
}): Promise<void> {
  await api.post('/users/invite', data);
}
