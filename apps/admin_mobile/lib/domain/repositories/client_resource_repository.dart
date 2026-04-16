import '../entities/client_resource.dart';
import '../../shared/types/paginated_result.dart';

abstract class ClientResourceRepository {
  Future<PaginatedResult<ClientResource>> getAll({int? page, String? search});
  Future<ClientResource> getById(int id);
  Future<ClientResource> create({
    int? clientId,
    Map<String, dynamic>? data,
    String? plate,
    String? brand,
    String? model,
    String? color,
    String? type,
  });
  Future<ClientResource> update(
    int id, {
    Map<String, dynamic>? data,
    String? plate,
    String? brand,
    String? model,
    String? color,
    String? type,
  });
  Future<List<dynamic>> getHistory(int id);
}
