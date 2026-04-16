import '../../../domain/entities/reservation.dart';
import '../../../domain/repositories/reservation_repository.dart';

class GetReservationUseCase {
  final ReservationRepository _repo;
  GetReservationUseCase(this._repo);

  Future<Reservation> call(int id) => _repo.getById(id);
}
