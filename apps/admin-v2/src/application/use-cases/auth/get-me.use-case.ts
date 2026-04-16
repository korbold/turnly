import type { AuthRepository } from '@/domain/repositories/auth.repository';

export class GetMeUseCase {
  constructor(private repo: AuthRepository) {}

  execute() {
    return this.repo.me();
  }
}
