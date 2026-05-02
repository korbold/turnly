// lib/core/network/api_client.dart
import 'package:dio/dio.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'auth_interceptor.dart';
import 'email_verification_interceptor.dart';
import 'tenant_interceptor.dart';

class ApiClient {
  static Dio? _instance;

  static String get baseUrl =>
      dotenv.env['API_BASE_URL'] ?? 'https://api.dev.goturnly.com/api/v1';

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
      EmailVerificationInterceptor(),
    ]);

    return dio;
  }

  /// Reset instance (useful for testing or logout)
  static void reset() {
    _instance = null;
  }
}
