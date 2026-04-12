import 'package:fpdart/fpdart.dart';
import '../../../../core/error/failures.dart';
import '../entities/reservation.dart';

class AvailableSlot {
  final DateTime start;
  final DateTime end;
  final int available;

  const AvailableSlot({
    required this.start,
    required this.end,
    required this.available,
  });
}

abstract class IReservationRepository {
  Future<Either<Failure, List<Reservation>>> getAll({String? status});
  Future<Either<Failure, Reservation>> getById(String id);
  Future<Either<Failure, Reservation>> create({
    required String vehicleId,
    required String serviceId,
    required String scheduledAt,
    String? notes,
  });
  Future<Either<Failure, List<AvailableSlot>>> getAvailableSlots(
    String date,
    String serviceId,
  );
  Future<Either<Failure, Unit>> cancel(String id, {String? reason});
}
