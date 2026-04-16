import '../../../domain/entities/user.dart';
import '../../../domain/repositories/user_repository.dart';
import '../../../shared/types/paginated_result.dart';

class GetTeamUseCase {
  final UserRepository _repo;
  GetTeamUseCase(this._repo);

  Future<PaginatedResult<User>> call({UserRole? role, UserRole? excludeRole}) =>
      _repo.getAll(role: role, excludeRole: excludeRole);
}
