import '../../../domain/entities/service.dart';
import '../../../domain/repositories/service_repository.dart';

class CreateServiceUseCase {
  final ServiceRepository _repo;
  CreateServiceUseCase(this._repo);

  Future<Service> call({
    required String name,
    required double price,
    String? description,
    String? imageUrl,
    bool? isActive,
  }) =>
      _repo.create(
        name: name,
        price: price,
        description: description,
        imageUrl: imageUrl,
        isActive: isActive,
      );
}
