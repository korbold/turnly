import '../../../domain/entities/service_log.dart';
import '../../../domain/repositories/service_log_repository.dart';

class CompleteServiceLogUseCase {
  final ServiceLogRepository _repo;
  CompleteServiceLogUseCase(this._repo);

  Future<ServiceLog> call(int id) => _repo.complete(id);
}
