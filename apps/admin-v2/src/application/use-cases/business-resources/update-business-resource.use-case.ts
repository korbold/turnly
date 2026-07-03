import type { BusinessResourceRepository } from '@/domain/repositories/business-resource.repository';
import type { BusinessResource, UpdateBusinessResourceInput } from '@/domain/entities/business-resource';

export class UpdateBusinessResourceUseCase {
  constructor(private repo: BusinessResourceRepository) {}
  execute(id: string, input: UpdateBusinessResourceInput): Promise<BusinessResource> {
    return this.repo.update(id, input);
  }
}
