import '../../../domain/entities/client_resource.dart';
import '../../../domain/repositories/client_resource_repository.dart';
import '../../../shared/types/paginated_result.dart';

class GetClientsUseCase {
  final ClientResourceRepository _repo;
  GetClientsUseCase(this._repo);

  Future<PaginatedResult<ClientResource>> call({int? page, String? search}) =>
      _repo.getAll(page: page, search: search);
}
