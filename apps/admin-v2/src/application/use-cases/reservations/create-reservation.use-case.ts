import type { ReservationRepository, CreateReservationData } from '@/domain/repositories/reservation.repository';

export class CreateReservationUseCase {
  constructor(private repo: ReservationRepository) {}

  execute(data: CreateReservationData) {
    return this.repo.create(data);
  }
}
