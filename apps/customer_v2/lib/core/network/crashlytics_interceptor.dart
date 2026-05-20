import 'package:dio/dio.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:flutter/foundation.dart';

class CrashlyticsInterceptor extends Interceptor {
  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    if (!kDebugMode) _record(err);
    handler.next(err);
  }

  void _record(DioException err) {
    final status = err.response?.statusCode;

    // 401/422 are expected user-facing flows, not bugs.
    if (status == 401 || status == 422) return;

    final endpoint =
        '${err.requestOptions.method} ${err.requestOptions.path}';

    FirebaseCrashlytics.instance.setCustomKey('last_endpoint', endpoint);
    if (status != null) {
      FirebaseCrashlytics.instance.setCustomKey('last_status_code', status);
    }

    final body = err.response?.data?.toString() ?? '';
    if (body.isNotEmpty) {
      FirebaseCrashlytics.instance.log('API error body: ${body.length > 200 ? body.substring(0, 200) : body}');
    }

    FirebaseCrashlytics.instance.recordError(
      err,
      err.stackTrace,
      reason: 'Non-fatal API error: $endpoint (HTTP $status)',
      fatal: false,
    );
  }
}
