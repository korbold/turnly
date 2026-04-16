// lib/core/storage/secure_storage.dart
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStorage {
  static const _storage = FlutterSecureStorage();

  static const _tokenKey = 'auth_token';
  static const _tenantSlugKey = 'tenant_slug';

  static Future<void> saveToken(String token) async {
    await _storage.write(key: _tokenKey, value: token);
  }

  static Future<String?> getToken() async {
    return await _storage.read(key: _tokenKey);
  }

  static Future<void> deleteToken() async {
    await _storage.delete(key: _tokenKey);
  }

  static Future<void> saveTenantSlug(String slug) async {
    await _storage.write(key: _tenantSlugKey, value: slug);
  }

  static Future<String?> getTenantSlug() async {
    return await _storage.read(key: _tenantSlugKey);
  }

  static Future<void> clear() async {
    await _storage.deleteAll();
  }
}
