import type { AuthRepository } from '@/domain/repositories/auth.repository';

export class RegisterUseCase {
  constructor(private repo: AuthRepository) {}

  execute(data: { name: string; email: string; password: string; businessName?: string }) {
    return this.repo.register(data);
  }
}
