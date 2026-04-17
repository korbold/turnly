// lib/core/network/tenant_interceptor.dart
import 'package:dio/dio.dart';
import '../storage/secure_storage.dart';

class TenantInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final slug = await SecureStorage.getTenantSlug();
    if (slug != null) {
      options.headers['X-Tenant'] = slug;
    }
    handler.next(options);
  }
}
