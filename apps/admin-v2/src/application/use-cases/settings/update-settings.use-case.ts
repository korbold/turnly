import type { TenantRepository } from '@/domain/repositories/tenant.repository';
import type { TenantSettings } from '@/domain/entities/tenant';

export class UpdateSettingsUseCase {
  constructor(private repo: TenantRepository) {}

  execute(data: Partial<TenantSettings>) {
    return this.repo.updateSettings(data);
  }
}
