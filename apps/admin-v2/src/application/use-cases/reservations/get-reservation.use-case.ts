import type { ReservationRepository } from '@/domain/repositories/reservation.repository';

export class GetReservationUseCase {
  constructor(private repo: ReservationRepository) {}

  execute(id: string) {
    return this.repo.getById(id);
  }
}
