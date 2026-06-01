import type { User, UserRole } from '../entities/user';
import type { PaginatedResult } from '../../shared/types/api';

export interface CreateMemberInput {
  name: string;
  username: string;
  password: string;
  email?: string | null;
  phone?: string | null;
  role: UserRole;
}

export interface UserRepository {
  getAll(filters?: { role?: UserRole; excludeRole?: UserRole }): Promise<PaginatedResult<User>>;
  getById(id: string): Promise<User>;
  invite(input: CreateMemberInput): Promise<User>;
  changeRole(id: string, role: UserRole): Promise<User>;
  resetPassword(id: string, password: string): Promise<void>;
}
