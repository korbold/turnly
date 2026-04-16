import '../../../domain/repositories/client_resource_repository.dart';

class GetClientHistoryUseCase {
  final ClientResourceRepository _repo;
  GetClientHistoryUseCase(this._repo);

  Future<List<dynamic>> call(int id) => _repo.getHistory(id);
}
