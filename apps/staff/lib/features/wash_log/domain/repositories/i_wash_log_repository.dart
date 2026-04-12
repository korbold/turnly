import 'package:fpdart/fpdart.dart';
import '../../../../core/error/failures.dart';
import '../entities/wash_log.dart';
import '../entities/daily_summary.dart';

abstract class IWashLogRepository {
  Future<Either<Failure, List<WashLog>>> getByDate(String date);
  Future<Either<Failure, WashLog>> create({
    required String vehicleId,
    required String serviceId,
    required String attendedBy,
    required double priceCharged,
    required String paymentMethod,
    String? reservationId,
    String? notes,
  });
  Future<Either<Failure, Unit>> complete(String id);
  Future<Either<Failure, DailySummary>> getDailySummary(String date);
}
