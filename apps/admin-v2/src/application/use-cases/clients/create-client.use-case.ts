import type { ClientResourceRepository, CreateClientResourceData } from '@/domain/repositories/client-resource.repository';

export class CreateClientUseCase {
  constructor(private repo: ClientResourceRepository) {}

  execute(data: CreateClientResourceData) {
    return this.repo.create(data);
  }
}
