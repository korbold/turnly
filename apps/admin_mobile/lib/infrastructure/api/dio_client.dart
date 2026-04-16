import 'package:dio/dio.dart';
import '../storage/secure_storage.dart';
import '../storage/preferences.dart';

class DioClient {
  final Dio dio;
  final SecureStorageService _secureStorage;
  final PreferencesService _preferences;

  DioClient({
    required SecureStorageService secureStorage,
    required PreferencesService preferences,
    String? baseUrl,
  })  : _secureStorage = secureStorage,
        _preferences = preferences,
        dio = Dio(BaseOptions(
          baseUrl: baseUrl ?? 'http://10.0.2.2:8000/api/v1',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          connectTimeout: const Duration(seconds: 15),
          receiveTimeout: const Duration(seconds: 15),
        )) {
    dio.interceptors.addAll([
      _AuthInterceptor(secureStorage: _secureStorage, preferences: _preferences),
      _ErrorInterceptor(secureStorage: _secureStorage, preferences: _preferences),
    ]);
  }
}

class _AuthInterceptor extends Interceptor {
  final SecureStorageService _secureStorage;
  final PreferencesService _preferences;

  _AuthInterceptor({
    required SecureStorageService secureStorage,
    required PreferencesService preferences,
  })  : _secureStorage = secureStorage,
        _preferences = preferences;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await _secureStorage.getToken();
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }

    final tenantSlug = _preferences.tenantSlug;
    if (tenantSlug != null) {
      options.headers['X-Tenant'] = tenantSlug;
    }

    handler.next(options);
  }
}

class _ErrorInterceptor extends Interceptor {
  final SecureStorageService _secureStorage;
  final PreferencesService _preferences;

  _ErrorInterceptor({
    required SecureStorageService secureStorage,
    required PreferencesService preferences,
  })  : _secureStorage = secureStorage,
        _preferences = preferences;

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    if (err.response?.statusCode == 401) {
      _secureStorage.clear();
      _preferences.clear();
    }
    handler.next(err);
  }
}
