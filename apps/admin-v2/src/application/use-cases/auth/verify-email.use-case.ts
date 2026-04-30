import type { AuthRepository } from '@/domain/repositories/auth.repository';

export class VerifyEmailUseCase {
  constructor(private repo: AuthRepository) {}

  execute(email: string, code: string) {
    return this.repo.verifyEmail(email, code);
  }
}
