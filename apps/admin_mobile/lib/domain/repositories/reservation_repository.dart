import '../entities/reservation.dart';
import '../../shared/types/paginated_result.dart';

abstract class ReservationRepository {
  Future<PaginatedResult<Reservation>> getAll(ReservationFilters filters);
  Future<Reservation> getById(int id);
  Future<Reservation> create({
    required int clientResourceId,
    required int serviceId,
    required String scheduledAt,
    int? assignedTo,
    String? notes,
  });
  Future<Reservation> cancel(int id, String reason);
  Future<Reservation> transition(int id, ReservationAction action);
  Future<List<AvailableSlot>> getAvailableSlots(String date, int serviceId);
}
