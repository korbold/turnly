import type { AuthRepository } from '@/domain/repositories/auth.repository';

export class ResendVerificationUseCase {
  constructor(private repo: AuthRepository) {}

  execute(email: string) {
    return this.repo.resendVerification(email);
  }
}
