// lib/features/reservations/domain/repositories/reservation_repository.dart
import 'package:fpdart/fpdart.dart';
import '../../../../core/error/failures.dart';
import '../entities/reservation.dart';
import '../entities/available_slot.dart';

abstract class ReservationRepository {
  Future<Either<Failure, List<Reservation>>> getAll({String? status});
  Future<Either<Failure, Reservation>> getById(String id);
  Future<Either<Failure, Reservation>> create({
    required String clientResourceId,
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
