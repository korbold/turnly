import type { ServiceRepository, CreateServiceData } from '@/domain/repositories/service.repository';

export class UpdateServiceUseCase {
  constructor(private repo: ServiceRepository) {}

  execute(id: string, data: Partial<CreateServiceData>) {
    return this.repo.update(id, data);
  }
}
