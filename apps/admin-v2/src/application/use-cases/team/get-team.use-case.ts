import type { UserRepository } from '@/domain/repositories/user.repository';
import type { UserRole } from '@/domain/entities/user';

export class GetTeamUseCase {
  constructor(private repo: UserRepository) {}

  execute(filters?: { role?: UserRole; excludeRole?: UserRole }) {
    return this.repo.getAll(filters);
  }
}
