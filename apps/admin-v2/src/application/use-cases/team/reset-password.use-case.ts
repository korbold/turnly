import type { UserRepository } from '@/domain/repositories/user.repository';

export class ResetPasswordUseCase {
  constructor(private repo: UserRepository) {}

  execute(id: string, password: string) {
    return this.repo.resetPassword(id, password);
  }
}
