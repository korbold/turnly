import '../../../domain/entities/reservation.dart';
import '../../../domain/repositories/reservation_repository.dart';

class GetAvailableSlotsUseCase {
  final ReservationRepository _repo;
  GetAvailableSlotsUseCase(this._repo);

  Future<List<AvailableSlot>> call(String date, int serviceId) =>
      _repo.getAvailableSlots(date, serviceId);
}
