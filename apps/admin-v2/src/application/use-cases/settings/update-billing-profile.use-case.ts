import type { TenantRepository } from '@/domain/repositories/tenant.repository';
import type { BillingProfileInput } from '@/domain/entities/tenant';

export class UpdateBillingProfileUseCase {
  constructor(private repo: TenantRepository) {}

  execute(input: BillingProfileInput) {
    return this.repo.updateBillingProfile(input);
  }
}
