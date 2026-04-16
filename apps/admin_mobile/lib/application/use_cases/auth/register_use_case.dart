import '../../../domain/repositories/auth_repository.dart';

class RegisterUseCase {
  final AuthRepository _repo;
  RegisterUseCase(this._repo);

  Future<LoginResult> call({
    required String name,
    required String email,
    required String password,
  }) =>
      _repo.register(name: name, email: email, password: password);
}
