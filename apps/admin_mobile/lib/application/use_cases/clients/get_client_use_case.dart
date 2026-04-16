import '../../../domain/entities/client_resource.dart';
import '../../../domain/repositories/client_resource_repository.dart';

class GetClientUseCase {
  final ClientResourceRepository _repo;
  GetClientUseCase(this._repo);

  Future<ClientResource> call(int id) => _repo.getById(id);
}
