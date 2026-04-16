import type { UserRepository } from '@/domain/repositories/user.repository';
import type { UserRole } from '@/domain/entities/user';

export class InviteUserUseCase {
  constructor(private repo: UserRepository) {}

  execute(email: string, role: UserRole) {
    return this.repo.invite(email, role);
  }
}
