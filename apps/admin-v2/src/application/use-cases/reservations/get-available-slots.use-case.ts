import type { ReservationRepository } from '@/domain/repositories/reservation.repository';

export class GetAvailableSlotsUseCase {
  constructor(private repo: ReservationRepository) {}

  execute(date: string, serviceId: string, durationMin?: number) {
    return this.repo.getAvailableSlots(date, serviceId, durationMin);
  }
}
