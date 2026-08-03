import type { AuthRepository } from '@/domain/repositories/auth.repository';

export class RequestPasswordResetUseCase {
  constructor(private repo: AuthRepository) {}

  execute(email: string) {
    return this.repo.requestPasswordReset(email);
  }
}
