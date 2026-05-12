// lib/core/network/email_verification_interceptor.dart
import 'package:dio/dio.dart';
import 'package:go_router/go_router.dart';

import '../../app/router.dart';

/// Catches 403 EMAIL_NOT_VERIFIED responses on any protected request and
/// redirects the user to /verify-email so they can finish onboarding,
/// instead of getting stuck on a "verify tu email" snackbar.
class EmailVerificationInterceptor extends Interceptor {
  bool _redirecting = false;

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    final status = err.response?.statusCode;
    final body = err.response?.data;

    if (status == 403 &&
        body is Map &&
        body['error'] is Map &&
        body['error']['code'] == 'EMAIL_NOT_VERIFIED' &&
        !_redirecting) {
      _redirecting = true;
      final email = body['error']['email']?.toString() ?? '';
      final ctx = rootNavigatorKey.currentContext;
      if (ctx != null) {
        // Defer until current frame settles so we don't navigate from inside a build.
        Future.microtask(() {
          try {
            // ignore: use_build_context_synchronously
            ctx.go('/verify-email?email=${Uri.encodeComponent(email)}');
          } finally {
            _redirecting = false;
          }
        });
      } else {
        _redirecting = false;
      }
    }

    handler.next(err);
  }
}
