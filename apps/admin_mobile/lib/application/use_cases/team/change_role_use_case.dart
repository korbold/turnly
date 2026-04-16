import '../../../domain/entities/user.dart';
import '../../../domain/repositories/user_repository.dart';

class ChangeRoleUseCase {
  final UserRepository _repo;
  ChangeRoleUseCase(this._repo);

  Future<User> call(int id, UserRole role) => _repo.changeRole(id, role);
}
