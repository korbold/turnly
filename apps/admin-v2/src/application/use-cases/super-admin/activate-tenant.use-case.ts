import type { SuperAdminRepository } from '@/domain/repositories/super-admin.repository';

export class ActivateTenantUseCase {
  constructor(private repo: SuperAdminRepository) {}

  execute(id: string) {
    return this.repo.activateTenant(id);
  }
}
