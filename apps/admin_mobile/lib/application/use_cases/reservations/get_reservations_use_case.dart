import '../../../domain/entities/reservation.dart';
import '../../../domain/repositories/reservation_repository.dart';
import '../../../shared/types/paginated_result.dart';

class GetReservationsUseCase {
  final ReservationRepository _repo;
  GetReservationsUseCase(this._repo);

  Future<PaginatedResult<Reservation>> call(ReservationFilters filters) =>
      _repo.getAll(filters);
}
