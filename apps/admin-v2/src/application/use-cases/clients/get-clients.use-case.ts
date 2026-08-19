import type { ClientResourceRepository } from '@/domain/repositories/client-resource.repository';

export class GetClientsUseCase {
  constructor(private repo: ClientResourceRepository) {}

  execute(page?: number, search?: string, withDebt?: boolean) {
    return this.repo.getAll(page, search, withDebt);
  }
}
