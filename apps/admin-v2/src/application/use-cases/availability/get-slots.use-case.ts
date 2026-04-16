import type { AvailabilityRepository } from '@/domain/repositories/availability.repository';

export class GetSlotsUseCase {
  constructor(private repo: AvailabilityRepository) {}

  execute() {
    return this.repo.getSlots();
  }
}
