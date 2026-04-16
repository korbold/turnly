import '../../../domain/entities/user.dart';
import '../../../domain/entities/tenant.dart';
import '../../../domain/repositories/auth_repository.dart';

class GetMeUseCase {
  final AuthRepository _repo;
  GetMeUseCase(this._repo);

  Future<({User user, Tenant? tenant})> call() => _repo.me();
}
