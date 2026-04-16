import type { TenantRepository } from '@/domain/repositories/tenant.repository';

export class GetImagesUseCase {
  constructor(private repo: TenantRepository) {}

  execute() {
    return this.repo.getImages();
  }
}
