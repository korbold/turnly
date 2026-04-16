import type { ClientResourceRepository } from '@/domain/repositories/client-resource.repository';

export class GetClientHistoryUseCase {
  constructor(private repo: ClientResourceRepository) {}

  execute(id: string) {
    return this.repo.getHistory(id);
  }
}
