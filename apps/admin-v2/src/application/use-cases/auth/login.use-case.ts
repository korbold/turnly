import type { AuthRepository } from '@/domain/repositories/auth.repository';

export class LoginUseCase {
  constructor(private repo: AuthRepository) {}

  execute(identifier: string, password: string) {
    return this.repo.login(identifier, password);
  }
}
