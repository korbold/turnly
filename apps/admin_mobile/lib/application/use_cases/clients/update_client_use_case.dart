import '../../../domain/entities/client_resource.dart';
import '../../../domain/repositories/client_resource_repository.dart';

class UpdateClientUseCase {
  final ClientResourceRepository _repo;
  UpdateClientUseCase(this._repo);

  Future<ClientResource> call(
    int id, {
    Map<String, dynamic>? data,
    String? plate,
    String? brand,
    String? model,
    String? color,
    String? type,
  }) =>
      _repo.update(
        id,
        data: data,
        plate: plate,
        brand: brand,
        model: model,
        color: color,
        type: type,
      );
}
