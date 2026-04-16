import '../entities/user.dart';
import '../entities/tenant.dart';

class LoginResult {
  final User user;
  final String token;
  final Tenant? tenant;

  const LoginResult({
    required this.user,
    required this.token,
    this.tenant,
  });
}

abstract class AuthRepository {
  Future<LoginResult> login(String email, String password);
  Future<LoginResult> register({
    required String name,
    required String email,
    required String password,
  });
  Future<void> logout();
  Future<({User user, Tenant? tenant})> me();
}
