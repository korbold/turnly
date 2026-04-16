import type { TenantRepository } from '@/domain/repositories/tenant.repository';

export class ReorderImagesUseCase {
  constructor(private repo: TenantRepository) {}

  execute(ids: string[]) {
    return this.repo.reorderImages(ids);
  }
}
