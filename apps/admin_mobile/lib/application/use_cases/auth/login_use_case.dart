import '../../../domain/repositories/auth_repository.dart';

class LoginUseCase {
  final AuthRepository _repo;
  LoginUseCase(this._repo);

  Future<LoginResult> call(String email, String password) =>
      _repo.login(email, password);
}
