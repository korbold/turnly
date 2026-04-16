import 'package:dio/dio.dart';
import '../../../domain/repositories/tenant_repository.dart';
import '../dio_client.dart';

class ApiTenantRepository implements TenantRepository {
  final DioClient _client;

  ApiTenantRepository(this._client);

  @override
  Future<Map<String, dynamic>> getSettings() async {
    final response = await _client.dio.get('/tenant/settings');
    return (response.data['data'] ?? response.data) as Map<String, dynamic>;
  }

  @override
  Future<Map<String, dynamic>> updateSettings(
      Map<String, dynamic> data) async {
    final response = await _client.dio.patch('/tenant/settings', data: data);
    return (response.data['data'] ?? response.data) as Map<String, dynamic>;
  }

  @override
  Future<List<Map<String, dynamic>>> getImages() async {
    final response = await _client.dio.get('/tenant/images');
    final data = response.data['data'] ?? response.data;
    return (data as List)
        .map((e) => e as Map<String, dynamic>)
        .toList();
  }

  @override
  Future<Map<String, dynamic>> addImage(String filePath) async {
    final formData = FormData.fromMap({
      'image': await MultipartFile.fromFile(filePath),
    });
    final response = await _client.dio.post('/tenant/images', data: formData);
    return (response.data['data'] ?? response.data) as Map<String, dynamic>;
  }

  @override
  Future<void> deleteImage(int id) async {
    await _client.dio.delete('/tenant/images/$id');
  }

  @override
  Future<void> reorderImages(List<int> ids) async {
    await _client.dio.post('/tenant/images/reorder', data: {
      'ids': ids,
    });
  }
}
