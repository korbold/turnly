import type { AvailabilityRepository } from '@/domain/repositories/availability.repository';
import type { AvailabilitySlot } from '@/domain/entities/availability';

export class UpdateSlotsUseCase {
  constructor(private repo: AvailabilityRepository) {}

  execute(slots: AvailabilitySlot[]) {
    return this.repo.updateSlots(slots);
  }
}
