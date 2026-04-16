import type { ReservationRepository } from '@/domain/repositories/reservation.repository';

export class CancelReservationUseCase {
  constructor(private repo: ReservationRepository) {}

  execute(id: string, reason: string) {
    return this.repo.cancel(id, reason);
  }
}
