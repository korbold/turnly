import type { ServiceLog } from '@/domain/entities/service-log';
import type { PriceChangeMeta, ServiceLogRepository, UpdateServiceLogItemsData } from '@/domain/repositories/service-log.repository';

export class UpdateServiceLogItemsUseCase {
  constructor(private repo: ServiceLogRepository) {}

  execute(id: string, items: UpdateServiceLogItemsData, meta?: PriceChangeMeta): Promise<ServiceLog> {
    return this.repo.updateItems(id, items, meta);
  }
}
