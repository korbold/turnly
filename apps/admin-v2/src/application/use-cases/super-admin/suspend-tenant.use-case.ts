import type { SuperAdminRepository } from '@/domain/repositories/super-admin.repository';

export class SuspendTenantUseCase {
  constructor(private repo: SuperAdminRepository) {}

  execute(id: string) {
    return this.repo.suspendTenant(id);
  }
}
