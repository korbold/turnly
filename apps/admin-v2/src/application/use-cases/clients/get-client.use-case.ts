import type { ClientResourceRepository } from '@/domain/repositories/client-resource.repository';

export class GetClientUseCase {
  constructor(private repo: ClientResourceRepository) {}

  execute(id: string) {
    return this.repo.getById(id);
  }
}
