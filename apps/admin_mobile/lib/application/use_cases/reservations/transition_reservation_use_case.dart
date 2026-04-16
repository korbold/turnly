import '../../../domain/entities/reservation.dart';
import '../../../domain/repositories/reservation_repository.dart';

class TransitionReservationUseCase {
  final ReservationRepository _repo;
  TransitionReservationUseCase(this._repo);

  Future<Reservation> call(int id, ReservationAction action) =>
      _repo.transition(id, action);
}
