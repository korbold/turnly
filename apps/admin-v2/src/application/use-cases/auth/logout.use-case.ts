import type { AuthRepository } from '@/domain/repositories/auth.repository';

export class LogoutUseCase {
  constructor(private repo: AuthRepository) {}

  execute() {
    return this.repo.logout();
  }
}
