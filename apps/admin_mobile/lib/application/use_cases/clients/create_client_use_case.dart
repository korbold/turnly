import '../../../domain/entities/client_resource.dart';
import '../../../domain/repositories/client_resource_repository.dart';

class CreateClientUseCase {
  final ClientResourceRepository _repo;
  CreateClientUseCase(this._repo);

  Future<ClientResource> call({
    int? clientId,
    Map<String, dynamic>? data,
    String? plate,
    String? brand,
    String? model,
    String? color,
    String? type,
  }) =>
      _repo.create(
        clientId: clientId,
        data: data,
        plate: plate,
        brand: brand,
        model: model,
        color: color,
        type: type,
      );
}
