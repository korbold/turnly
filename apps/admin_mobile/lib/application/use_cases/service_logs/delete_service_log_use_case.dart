import '../../../domain/repositories/service_log_repository.dart';

class DeleteServiceLogUseCase {
  final ServiceLogRepository _repo;
  DeleteServiceLogUseCase(this._repo);

  Future<void> call(int id) => _repo.delete(id);
}
