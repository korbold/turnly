import '../../../domain/entities/reservation.dart';
import '../../../domain/repositories/reservation_repository.dart';

class CancelReservationUseCase {
  final ReservationRepository _repo;
  CancelReservationUseCase(this._repo);

  Future<Reservation> call(int id, String reason) =>
      _repo.cancel(id, reason);
}
