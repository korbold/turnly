import 'package:fpdart/fpdart.dart';
import '../../../../core/error/failures.dart';
import '../entities/reservation.dart';

abstract class IReservationRepository {
  Future<Either<Failure, List<Reservation>>> getAll({String? date, String? status});
  Future<Either<Failure, Reservation>> getById(String id);
  Future<Either<Failure, Unit>> confirm(String id);
  Future<Either<Failure, Unit>> start(String id);
  Future<Either<Failure, Unit>> complete(String id);
  Future<Either<Failure, Unit>> cancel(String id, {String? reason});
}
