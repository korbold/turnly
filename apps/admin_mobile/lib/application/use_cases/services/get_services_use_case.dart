import '../../../domain/entities/service.dart';
import '../../../domain/repositories/service_repository.dart';
import '../../../shared/types/paginated_result.dart';

class GetServicesUseCase {
  final ServiceRepository _repo;
  GetServicesUseCase(this._repo);

  Future<PaginatedResult<Service>> call({int? page}) =>
      _repo.getAll(page: page);
}
