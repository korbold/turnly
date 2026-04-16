import '../../../domain/entities/user.dart';
import '../../../domain/repositories/user_repository.dart';

class InviteUserUseCase {
  final UserRepository _repo;
  InviteUserUseCase(this._repo);

  Future<User> call(String email, UserRole role) => _repo.invite(email, role);
}
