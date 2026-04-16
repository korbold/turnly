import '../../../domain/repositories/report_repository.dart';

class GetRangeReportUseCase {
  final ReportRepository _repo;
  GetRangeReportUseCase(this._repo);

  Future<Map<String, dynamic>> call(String from, String to) =>
      _repo.getRange(from, to);
}
