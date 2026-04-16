import '../entities/user.dart';
import '../../shared/types/paginated_result.dart';

abstract class UserRepository {
  Future<PaginatedResult<User>> getAll({UserRole? role, UserRole? excludeRole});
  Future<User> getById(int id);
  Future<User> invite(String email, UserRole role);
  Future<User> changeRole(int id, UserRole role);
}
