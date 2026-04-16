import '../../../domain/entities/user.dart';
import '../../../domain/entities/tenant.dart';
import '../../../domain/repositories/auth_repository.dart';
import '../dio_client.dart';
import '../mappers/user_mapper.dart';
import '../mappers/tenant_mapper.dart';

class ApiAuthRepository implements AuthRepository {
  final DioClient _client;

  ApiAuthRepository(this._client);

  @override
  Future<LoginResult> login(String email, String password) async {
    final response = await _client.dio.post('/auth/login', data: {
      'email': email,
      'password': password,
    });
    final data = response.data['data'] ?? response.data;
    return LoginResult(
      user: mapUser(data['user'] as Map<String, dynamic>),
      token: data['token'] as String,
      tenant: data['tenant'] != null
          ? mapTenant(data['tenant'] as Map<String, dynamic>)
          : null,
    );
  }

  @override
  Future<LoginResult> register({
    required String name,
    required String email,
    required String password,
  }) async {
    final response = await _client.dio.post('/auth/register', data: {
      'name': name,
      'email': email,
      'password': password,
    });
    final data = response.data['data'] ?? response.data;
    return LoginResult(
      user: mapUser(data['user'] as Map<String, dynamic>),
      token: data['token'] as String,
      tenant: data['tenant'] != null
          ? mapTenant(data['tenant'] as Map<String, dynamic>)
          : null,
    );
  }

  @override
  Future<void> logout() async {
    await _client.dio.post('/auth/logout');
  }

  @override
  Future<({User user, Tenant? tenant})> me() async {
    final response = await _client.dio.get('/auth/me');
    final data = response.data['data'] ?? response.data;
    return (
      user: mapUser(data['user'] as Map<String, dynamic>),
      tenant: data['tenant'] != null
          ? mapTenant(data['tenant'] as Map<String, dynamic>)
          : null,
    );
  }
}
