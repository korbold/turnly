import type { SuperAdminRepository } from '@/domain/repositories/super-admin.repository';

export class GetTenantsUseCase {
  constructor(private repo: SuperAdminRepository) {}

  execute(page?: number) {
    return this.repo.getTenants(page);
  }
}
