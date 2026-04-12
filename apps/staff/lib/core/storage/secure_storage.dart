import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStorage {
  static const _storage = FlutterSecureStorage();

  static const _tokenKey = 'auth_token';
  static const _tenantSlugKey = 'tenant_slug';
  static const _userRoleKey = 'user_role';
  static const _userIdKey = 'user_id';
  static const _userNameKey = 'user_name';

  // Token
  static Future<void> saveToken(String token) async {
    await _storage.write(key: _tokenKey, value: token);
  }

  static Future<String?> getToken() async {
    return await _storage.read(key: _tokenKey);
  }

  // Tenant
  static Future<void> saveTenantSlug(String slug) async {
    await _storage.write(key: _tenantSlugKey, value: slug);
  }

  static Future<String?> getTenantSlug() async {
    return await _storage.read(key: _tenantSlugKey);
  }

  // Role
  static Future<void> saveRole(String role) async {
    await _storage.write(key: _userRoleKey, value: role);
  }

  static Future<String?> getRole() async {
    return await _storage.read(key: _userRoleKey);
  }

  // User ID
  static Future<void> saveUserId(String id) async {
    await _storage.write(key: _userIdKey, value: id);
  }

  static Future<String?> getUserId() async {
    return await _storage.read(key: _userIdKey);
  }

  // User Name
  static Future<void> saveUserName(String name) async {
    await _storage.write(key: _userNameKey, value: name);
  }

  static Future<String?> getUserName() async {
    return await _storage.read(key: _userNameKey);
  }

  // Clear all
  static Future<void> clear() async {
    await _storage.deleteAll();
  }
}
