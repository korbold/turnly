import '../../../domain/repositories/service_repository.dart';

class DeleteServiceUseCase {
  final ServiceRepository _repo;
  DeleteServiceUseCase(this._repo);

  Future<void> call(int id) => _repo.delete(id);
}
