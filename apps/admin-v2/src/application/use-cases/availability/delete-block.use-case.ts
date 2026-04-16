import type { AvailabilityRepository } from '@/domain/repositories/availability.repository';

export class DeleteBlockUseCase {
  constructor(private repo: AvailabilityRepository) {}

  execute(id: string) {
    return this.repo.deleteBlock(id);
  }
}
