import type { UserRepository } from '@/domain/repositories/user.repository';
import type { UserRole } from '@/domain/entities/user';

export class ChangeRoleUseCase {
  constructor(private repo: UserRepository) {}

  execute(id: string, role: UserRole) {
    return this.repo.changeRole(id, role);
  }
}
