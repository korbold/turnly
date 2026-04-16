import '../../../domain/entities/service_log.dart';
import '../../../domain/repositories/service_log_repository.dart';
import '../../../shared/types/paginated_result.dart';

class GetServiceLogsUseCase {
  final ServiceLogRepository _repo;
  GetServiceLogsUseCase(this._repo);

  Future<PaginatedResult<ServiceLog>> call({String? date, int? page}) =>
      _repo.getAll(date: date, page: page);
}
