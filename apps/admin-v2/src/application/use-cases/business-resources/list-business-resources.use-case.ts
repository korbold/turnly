import type { BusinessResourceRepository } from '@/domain/repositories/business-resource.repository';
import type { BusinessResource } from '@/domain/entities/business-resource';

export class ListBusinessResourcesUseCase {
  constructor(private repo: BusinessResourceRepository) {}
  execute(): Promise<BusinessResource[]> {
    return this.repo.list();
  }
}
