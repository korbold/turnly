import type { ServiceRepository, CreateServiceData } from '@/domain/repositories/service.repository';

export class CreateServiceUseCase {
  constructor(private repo: ServiceRepository) {}

  execute(data: CreateServiceData) {
    return this.repo.create(data);
  }
}
