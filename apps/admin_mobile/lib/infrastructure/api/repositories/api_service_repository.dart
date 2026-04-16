import '../../../domain/entities/service.dart';
import '../../../domain/repositories/service_repository.dart';
import '../../../shared/types/paginated_result.dart';
import '../dio_client.dart';
import '../mappers/service_mapper.dart';
import 'paginated_helper.dart';

class ApiServiceRepository implements ServiceRepository {
  final DioClient _client;

  ApiServiceRepository(this._client);

  @override
  Future<PaginatedResult<Service>> getAll({int? page}) async {
    final params = <String, dynamic>{};
    if (page != null) params['page'] = page;

    final response =
        await _client.dio.get('/services', queryParameters: params);
    return extractPaginated(response.data, mapService);
  }

  @override
  Future<Service> create({
    required String name,
    required double price,
    String? description,
    String? imageUrl,
    bool? isActive,
  }) async {
    final body = <String, dynamic>{
      'name': name,
      'price': price,
    };
    if (description != null) body['description'] = description;
    if (imageUrl != null) body['image_url'] = imageUrl;
    if (isActive != null) body['is_active'] = isActive;

    final response = await _client.dio.post('/services', data: body);
    final data = response.data['data'] ?? response.data;
    return mapService(data as Map<String, dynamic>);
  }

  @override
  Future<Service> update(
    int id, {
    String? name,
    double? price,
    String? description,
    String? imageUrl,
    bool? isActive,
    int? sortOrder,
  }) async {
    final body = <String, dynamic>{};
    if (name != null) body['name'] = name;
    if (price != null) body['price'] = price;
    if (description != null) body['description'] = description;
    if (imageUrl != null) body['image_url'] = imageUrl;
    if (isActive != null) body['is_active'] = isActive;
    if (sortOrder != null) body['sort_order'] = sortOrder;

    final response = await _client.dio.put('/services/$id', data: body);
    final data = response.data['data'] ?? response.data;
    return mapService(data as Map<String, dynamic>);
  }

  @override
  Future<void> delete(int id) async {
    await _client.dio.delete('/services/$id');
  }
}
