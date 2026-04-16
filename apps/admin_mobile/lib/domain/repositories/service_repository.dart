import '../entities/service.dart';
import '../../shared/types/paginated_result.dart';

abstract class ServiceRepository {
  Future<PaginatedResult<Service>> getAll({int? page});
  Future<Service> create({
    required String name,
    required double price,
    String? description,
    String? imageUrl,
    bool? isActive,
  });
  Future<Service> update(
    int id, {
    String? name,
    double? price,
    String? description,
    String? imageUrl,
    bool? isActive,
    int? sortOrder,
  });
  Future<void> delete(int id);
}
