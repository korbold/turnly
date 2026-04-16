import type { AvailabilityRepository, CreateBlockData } from '@/domain/repositories/availability.repository';

export class CreateBlockUseCase {
  constructor(private repo: AvailabilityRepository) {}

  execute(data: CreateBlockData) {
    return this.repo.createBlock(data);
  }
}
