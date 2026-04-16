import type { User, UserRole } from '../entities/user';
import type { PaginatedResult } from '../../shared/types/api';

export interface UserRepository {
  getAll(filters?: { role?: UserRole; excludeRole?: UserRole }): Promise<PaginatedResult<User>>;
  getById(id: string): Promise<User>;
  invite(email: string, role: UserRole): Promise<User>;
  changeRole(id: string, role: UserRole): Promise<User>;
}
