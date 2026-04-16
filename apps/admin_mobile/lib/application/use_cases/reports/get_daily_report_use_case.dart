import '../../../domain/repositories/report_repository.dart';

class GetDailyReportUseCase {
  final ReportRepository _repo;
  GetDailyReportUseCase(this._repo);

  Future<Map<String, dynamic>> call(String date) => _repo.getDaily(date);
}
