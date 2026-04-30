import type { TenantRepository } from '@/domain/repositories/tenant.repository';

export class GetBillingProfileUseCase {
  constructor(private repo: TenantRepository) {}

  execute() {
    return this.repo.getBillingProfile();
  }
}
