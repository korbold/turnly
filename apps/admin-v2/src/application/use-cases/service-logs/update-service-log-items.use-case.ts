import type { ServiceLogRepository, UpdateServiceLogItemsData } from '@/domain/repositories/service-log.repository';

export class UpdateServiceLogItemsUseCase {
  constructor(private repo: ServiceLogRepository) {}

  execute(id: string, items: UpdateServiceLogItemsData) {
    return this.repo.updateItems(id, items);
  }
}
