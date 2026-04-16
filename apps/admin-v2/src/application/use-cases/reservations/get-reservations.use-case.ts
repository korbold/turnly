import type { ReservationRepository } from '@/domain/repositories/reservation.repository';
import type { ReservationFilters } from '@/domain/entities/reservation';

export class GetReservationsUseCase {
  constructor(private repo: ReservationRepository) {}

  execute(filters: ReservationFilters) {
    return this.repo.getAll(filters);
  }
}
