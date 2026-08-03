import type { AuthRepository } from '@/domain/repositories/auth.repository';

export class ResetPasswordUseCase {
  constructor(private repo: AuthRepository) {}

  execute(input: { email: string; token: string; password: string }) {
    return this.repo.resetPassword(input);
  }
}
