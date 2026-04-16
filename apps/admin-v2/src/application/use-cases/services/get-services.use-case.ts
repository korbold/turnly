import type { ServiceRepository } from '@/domain/repositories/service.repository';

export class GetServicesUseCase {
  constructor(private repo: ServiceRepository) {}

  execute(page?: number) {
    return this.repo.getAll(page);
  }
}
