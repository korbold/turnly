import type { AvailabilityRepository } from '@/domain/repositories/availability.repository';

export class GetBlocksUseCase {
  constructor(private repo: AvailabilityRepository) {}

  execute() {
    return this.repo.getBlocks();
  }
}
