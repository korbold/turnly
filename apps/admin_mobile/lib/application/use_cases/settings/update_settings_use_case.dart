import '../../../domain/repositories/tenant_repository.dart';

class UpdateSettingsUseCase {
  final TenantRepository _repo;
  UpdateSettingsUseCase(this._repo);

  Future<Map<String, dynamic>> call(Map<String, dynamic> data) =>
      _repo.updateSettings(data);
}
