import '../../../domain/entities/client_resource.dart';
import '../../../domain/repositories/client_resource_repository.dart';
import '../../../shared/types/paginated_result.dart';
import '../dio_client.dart';
import '../mappers/client_resource_mapper.dart';
import 'paginated_helper.dart';

class ApiClientResourceRepository implements ClientResourceRepository {
  final DioClient _client;

  ApiClientResourceRepository(this._client);

  @override
  Future<PaginatedResult<ClientResource>> getAll(
      {int? page, String? search}) async {
    final params = <String, dynamic>{};
    if (page != null) params['page'] = page;
    if (search != null) params['search'] = search;

    final response =
        await _client.dio.get('/client-resources', queryParameters: params);
    return extractPaginated(response.data, mapClientResource);
  }

  @override
  Future<ClientResource> getById(int id) async {
    final response = await _client.dio.get('/client-resources/$id');
    final data = response.data['data'] ?? response.data;
    return mapClientResource(data as Map<String, dynamic>);
  }

  @override
  Future<ClientResource> create({
    int? clientId,
    Map<String, dynamic>? data,
    String? plate,
    String? brand,
    String? model,
    String? color,
    String? type,
  }) async {
    final body = <String, dynamic>{};
    if (clientId != null) body['client_id'] = clientId;
    if (data != null) body['data'] = data;
    if (plate != null) body['plate'] = plate;
    if (brand != null) body['brand'] = brand;
    if (model != null) body['model'] = model;
    if (color != null) body['color'] = color;
    if (type != null) body['type'] = type;

    final response = await _client.dio.post('/client-resources', data: body);
    final respData = response.data['data'] ?? response.data;
    return mapClientResource(respData as Map<String, dynamic>);
  }

  @override
  Future<ClientResource> update(
    int id, {
    Map<String, dynamic>? data,
    String? plate,
    String? brand,
    String? model,
    String? color,
    String? type,
  }) async {
    final body = <String, dynamic>{};
    if (data != null) body['data'] = data;
    if (plate != null) body['plate'] = plate;
    if (brand != null) body['brand'] = brand;
    if (model != null) body['model'] = model;
    if (color != null) body['color'] = color;
    if (type != null) body['type'] = type;

    final response =
        await _client.dio.patch('/client-resources/$id', data: body);
    final respData = response.data['data'] ?? response.data;
    return mapClientResource(respData as Map<String, dynamic>);
  }

  @override
  Future<List<dynamic>> getHistory(int id) async {
    final response = await _client.dio.get('/client-resources/$id/history');
    final data = response.data['data'] ?? response.data;
    return data as List<dynamic>;
  }
}
