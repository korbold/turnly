import 'package:fpdart/fpdart.dart';
import '../../../../core/error/failures.dart';
import '../entities/service_log.dart';
import '../entities/daily_summary.dart';

abstract class IServiceLogRepository {
  Future<Either<Failure, List<ServiceLog>>> getByDate(String date);
  Future<Either<Failure, ServiceLog>> create({
    required String clientResourceId,
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
