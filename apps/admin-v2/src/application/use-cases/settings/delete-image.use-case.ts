import type { TenantRepository } from '@/domain/repositories/tenant.repository';

export class DeleteImageUseCase {
  constructor(private repo: TenantRepository) {}

  execute(id: string) {
    return this.repo.deleteImage(id);
  }
}
