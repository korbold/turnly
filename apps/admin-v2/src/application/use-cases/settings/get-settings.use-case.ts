import type { TenantRepository } from '@/domain/repositories/tenant.repository';

export class GetSettingsUseCase {
  constructor(private repo: TenantRepository) {}

  execute() {
    return this.repo.getSettings();
  }
}
