// lib/core/network/email_verification_interceptor.dart
import 'package:dio/dio.dart';

/// Previously this interceptor caught 403 EMAIL_NOT_VERIFIED on ANY request
/// and did a global `ctx.go('/verify-email')`. That was harmful:
///
///   1. It hijacked navigation from BACKGROUND fetches (e.g. the booking
///      screen auto-loading /client-resources on open). A `.go()` replaces
///      the whole nav stack, so the screen the user just opened was torn
///      down mid-frame — it looked like the screen "opened and closed".
///   2. `/verify-email` is a legacy passwordless route that just redirects
///      to `/login`, so the user was silently kicked out with no explanation.
///
/// Passwordless magic-link / Google / claim logins all set email_verified_at,
/// so a 403 EMAIL_NOT_VERIFIED is a rare data-anomaly state, not a normal
/// onboarding step. We let the error propagate to the calling cubit, which
/// already surfaces the server message inline. No global navigation happens
/// here. If a real "verify your email" screen is ever built, route to it from
/// the specific screen that needs it — not from a global error interceptor.
class EmailVerificationInterceptor extends Interceptor {
  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    handler.next(err);
  }
}
