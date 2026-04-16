import '../../../domain/entities/tenant.dart';
import '../../../domain/entities/user.dart';
import '../../../domain/repositories/super_admin_repository.dart';
import '../../../shared/types/paginated_result.dart';
import '../dio_client.dart';
import '../mappers/tenant_mapper.dart';
import '../mappers/user_mapper.dart';
import 'paginated_helper.dart';

class ApiSuperAdminRepository implements SuperAdminRepository {
  final DioClient _client;

  ApiSuperAdminRepository(this._client);

  @override
  Future<Map<String, dynamic>> getStats() async {
    final response = await _client.dio.get('/superadmin/stats');
    return (response.data['data'] ?? response.data) as Map<String, dynamic>;
  }

  @override
  Future<PaginatedResult<Tenant>> getTenants({int? page}) async {
    final params = <String, dynamic>{};
    if (page != null) params['page'] = page;

    final response =
        await _client.dio.get('/superadmin/tenants', queryParameters: params);
    return extractPaginated(response.data, mapTenant);
  }

  @override
  Future<Tenant> suspendTenant(int id) async {
    final response =
        await _client.dio.patch('/superadmin/tenants/$id/suspend');
    final data = response.data['data'] ?? response.data;
    return mapTenant(data as Map<String, dynamic>);
  }

  @override
  Future<Tenant> activateTenant(int id) async {
    final response =
        await _client.dio.patch('/superadmin/tenants/$id/activate');
    final data = response.data['data'] ?? response.data;
    return mapTenant(data as Map<String, dynamic>);
  }

  @override
  Future<PaginatedResult<User>> getUsers({int? page}) async {
    final params = <String, dynamic>{};
    if (page != null) params['page'] = page;

    final response =
        await _client.dio.get('/superadmin/users', queryParameters: params);
    return extractPaginated(response.data, mapUser);
  }
}
