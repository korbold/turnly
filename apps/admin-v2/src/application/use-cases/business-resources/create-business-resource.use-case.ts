import type { BusinessResourceRepository } from '@/domain/repositories/business-resource.repository';
import type { BusinessResource, CreateBusinessResourceInput } from '@/domain/entities/business-resource';

export class CreateBusinessResourceUseCase {
  constructor(private repo: BusinessResourceRepository) {}
  execute(input: CreateBusinessResourceInput): Promise<BusinessResource> {
    return this.repo.create(input);
  }
}
