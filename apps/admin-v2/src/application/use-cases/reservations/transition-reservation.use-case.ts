import type { ReservationRepository } from '@/domain/repositories/reservation.repository';
import type { ReservationAction } from '@/domain/entities/reservation';

export class TransitionReservationUseCase {
  constructor(private repo: ReservationRepository) {}

  execute(id: string, action: ReservationAction) {
    return this.repo.transition(id, action);
  }
}
