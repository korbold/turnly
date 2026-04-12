import 'package:fpdart/fpdart.dart';
import '../../../../core/error/failures.dart';
import '../entities/daily_report.dart';

abstract class IDashboardRepository {
  Future<Either<Failure, DailyReport>> getDailyReport(String date);
}
