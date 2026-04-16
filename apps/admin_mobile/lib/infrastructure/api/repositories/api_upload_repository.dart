import 'package:dio/dio.dart';
import '../../../domain/repositories/upload_repository.dart';
import '../dio_client.dart';

class ApiUploadRepository implements UploadRepository {
  final DioClient _client;

  ApiUploadRepository(this._client);

  @override
  Future<String> upload(String filePath, String folder) async {
    final formData = FormData.fromMap({
      'file': await MultipartFile.fromFile(filePath),
      'folder': folder,
    });
    final response = await _client.dio.post('/uploads', data: formData);
    final data = response.data['data'] ?? response.data;
    return data['url'] as String;
  }
}
