import type { SuperAdminRepository } from '@/domain/repositories/super-admin.repository';

export class GetUsersUseCase {
  constructor(private repo: SuperAdminRepository) {}

  execute(page?: number) {
    return this.repo.getUsers(page);
  }
}
