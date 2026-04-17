// lib/core/network/api_client.dart
import 'package:dio/dio.dart';
import 'auth_interceptor.dart';
import 'tenant_interceptor.dart';

class ApiClient {
  static Dio? _instance;

  static const String baseUrl = 'http://192.168.1.7:8000/api/v1';

  static Dio get instance {
    _instance ??= _createDio();
    return _instance!;
  }

  static Dio _createDio() {
    final dio = Dio(BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ));

    dio.interceptors.addAll([
      AuthInterceptor(),
      TenantInterceptor(),
    ]);

    return dio;
  }

  /// Reset instance (useful for testing or logout)
  static void reset() {
    _instance = null;
  }
}
