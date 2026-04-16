import '../../../domain/entities/service_log.dart';
import '../../../domain/repositories/service_log_repository.dart';

class GetDailySummaryUseCase {
  final ServiceLogRepository _repo;
  GetDailySummaryUseCase(this._repo);

  Future<DailySummary> call(String date) => _repo.getSummary(date);
}
