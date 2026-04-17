// lib/core/storage/secure_storage.dart
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStorage {
  static const _storage = FlutterSecureStorage();

  static const _tokenKey = 'auth_token';
  static const _tenantSlugKey = 'tenant_slug';

  // Token
  static Future<void> saveToken(String token) =>
      _storage.write(key: _tokenKey, value: token);

  static Future<String?> getToken() =>
      _storage.read(key: _tokenKey);

  static Future<void> deleteToken() =>
      _storage.delete(key: _tokenKey);

  // Tenant
  static Future<void> saveTenantSlug(String slug) =>
      _storage.write(key: _tenantSlugKey, value: slug);

  static Future<String?> getTenantSlug() =>
      _storage.read(key: _tenantSlugKey);

  // Clear all
  static Future<void> clear() => _storage.deleteAll();
}
