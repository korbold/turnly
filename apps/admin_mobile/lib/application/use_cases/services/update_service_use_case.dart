import '../../../domain/entities/service.dart';
import '../../../domain/repositories/service_repository.dart';

class UpdateServiceUseCase {
  final ServiceRepository _repo;
  UpdateServiceUseCase(this._repo);

  Future<Service> call(
    int id, {
    String? name,
    double? price,
    String? description,
    String? imageUrl,
    bool? isActive,
    int? sortOrder,
  }) =>
      _repo.update(
        id,
        name: name,
        price: price,
        description: description,
        imageUrl: imageUrl,
        isActive: isActive,
        sortOrder: sortOrder,
      );
}
