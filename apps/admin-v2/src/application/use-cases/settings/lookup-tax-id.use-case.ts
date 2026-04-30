import type { TenantRepository } from '@/domain/repositories/tenant.repository';
import type { TaxIdType } from '@/domain/entities/tenant';

export class LookupTaxIdUseCase {
  constructor(private repo: TenantRepository) {}

  execute(type: TaxIdType, taxId: string) {
    return this.repo.lookupTaxId(type, taxId);
  }
}
