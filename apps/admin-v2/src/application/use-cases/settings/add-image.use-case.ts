import type { TenantRepository } from '@/domain/repositories/tenant.repository';

export class AddImageUseCase {
  constructor(private repo: TenantRepository) {}

  execute(file: File) {
    return this.repo.addImage(file);
  }
}
