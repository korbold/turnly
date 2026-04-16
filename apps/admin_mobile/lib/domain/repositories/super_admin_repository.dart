import '../entities/tenant.dart';
import '../entities/user.dart';
import '../../shared/types/paginated_result.dart';

abstract class SuperAdminRepository {
  Future<Map<String, dynamic>> getStats();
  Future<PaginatedResult<Tenant>> getTenants({int? page});
  Future<Tenant> suspendTenant(int id);
  Future<Tenant> activateTenant(int id);
  Future<PaginatedResult<User>> getUsers({int? page});
}
