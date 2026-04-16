import type { ServiceRepository } from '@/domain/repositories/service.repository';

export class DeleteServiceUseCase {
  constructor(private repo: ServiceRepository) {}

  execute(id: string) {
    return this.repo.delete(id);
  }
}
