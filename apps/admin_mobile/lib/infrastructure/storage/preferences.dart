import 'package:shared_preferences/shared_preferences.dart';

class PreferencesService {
  static const _tenantSlugKey = 'tenant_slug';
  static const _isSuperAdminKey = 'is_super_admin';

  late SharedPreferences _prefs;

  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
  }

  String? get tenantSlug => _prefs.getString(_tenantSlugKey);

  Future<void> setTenantSlug(String slug) =>
      _prefs.setString(_tenantSlugKey, slug);

  bool get isSuperAdmin => _prefs.getBool(_isSuperAdminKey) ?? false;

  Future<void> setIsSuperAdmin(bool value) =>
      _prefs.setBool(_isSuperAdminKey, value);

  Future<void> clear() => _prefs.clear();
}
