import '../../../domain/repositories/tenant_repository.dart';

class GetSettingsUseCase {
  final TenantRepository _repo;
  GetSettingsUseCase(this._repo);

  Future<Map<String, dynamic>> call() => _repo.getSettings();
}
