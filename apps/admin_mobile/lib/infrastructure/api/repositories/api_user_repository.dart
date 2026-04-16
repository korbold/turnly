import '../../../domain/entities/user.dart';
import '../../../domain/repositories/user_repository.dart';
import '../../../shared/types/paginated_result.dart';
import '../dio_client.dart';
import '../mappers/user_mapper.dart';
import 'paginated_helper.dart';

class ApiUserRepository implements UserRepository {
  final DioClient _client;

  ApiUserRepository(this._client);

  @override
  Future<PaginatedResult<User>> getAll(
      {UserRole? role, UserRole? excludeRole}) async {
    final params = <String, dynamic>{};
    if (role != null) params['role'] = role.apiValue;
    if (excludeRole != null) params['exclude_role'] = excludeRole.apiValue;

    final response = await _client.dio.get('/users', queryParameters: params);
    return extractPaginated(response.data, mapUser);
  }

  @override
  Future<User> getById(int id) async {
    final response = await _client.dio.get('/users/$id');
    final data = response.data['data'] ?? response.data;
    return mapUser(data as Map<String, dynamic>);
  }

  @override
  Future<User> invite(String email, UserRole role) async {
    final response = await _client.dio.post('/users/invite', data: {
      'email': email,
      'role': role.apiValue,
    });
    final data = response.data['data'] ?? response.data;
    return mapUser(data as Map<String, dynamic>);
  }

  @override
  Future<User> changeRole(int id, UserRole role) async {
    final response = await _client.dio.patch('/users/$id/role', data: {
      'role': role.apiValue,
    });
    final data = response.data['data'] ?? response.data;
    return mapUser(data as Map<String, dynamic>);
  }
}
