import type { BusinessResourceRepository } from '@/domain/repositories/business-resource.repository';

export class DeleteBusinessResourceUseCase {
  constructor(private repo: BusinessResourceRepository) {}
  execute(id: string): Promise<void> {
    return this.repo.remove(id);
  }
}
