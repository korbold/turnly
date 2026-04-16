import type { ClientResourceRepository, CreateClientResourceData } from '@/domain/repositories/client-resource.repository';

export class UpdateClientUseCase {
  constructor(private repo: ClientResourceRepository) {}

  execute(id: string, data: Partial<CreateClientResourceData>) {
    return this.repo.update(id, data);
  }
}
