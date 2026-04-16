import '../../../domain/entities/reservation.dart';
import '../../../domain/repositories/reservation_repository.dart';

class CreateReservationUseCase {
  final ReservationRepository _repo;
  CreateReservationUseCase(this._repo);

  Future<Reservation> call({
    required int clientResourceId,
    required int serviceId,
    required String scheduledAt,
    int? assignedTo,
    String? notes,
  }) =>
      _repo.create(
        clientResourceId: clientResourceId,
        serviceId: serviceId,
        scheduledAt: scheduledAt,
        assignedTo: assignedTo,
        notes: notes,
      );
}
