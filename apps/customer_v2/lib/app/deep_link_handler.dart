// lib/app/deep_link_handler.dart
//
// Bridges Android App Links (https://goturnly.com/<slug>) into go_router so
// tapping a Turnly URL anywhere on the device opens the customer app on the
// matching business detail screen.

import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:firebase_auth/firebase_auth.dart' hide User;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/presentation/cubit/auth_cubit.dart';
import 'router.dart';

const _allowedHosts = {'goturnly.com', 'dev.goturnly.com'};

const _reservedPaths = <String>{
  '',
  'login',
  'register',
  'verify-email',
  'forgot-password',
  'dashboard',
  'reservations',
  'service-logs',
  'clients',
  'services',
  'team',
  'reports',
  'plan',
  'settings',
  'super-admin',
  'explorar',
  'terms',
  'privacy',
  'api',
  '_next',
  '.well-known',
};

class DeepLinkHandler {
  DeepLinkHandler._();

  static final DeepLinkHandler instance = DeepLinkHandler._();

  final AppLinks _appLinks = AppLinks();
  StreamSubscription<Uri>? _sub;
  bool _started = false;

  Future<void> start() async {
    if (_started) return;
    _started = true;

    // Cold-start: app launched via a link.
    final initial = await _appLinks.getInitialLink();
    if (initial != null) _handle(initial);

    // Warm-start: link received while app already running.
    _sub = _appLinks.uriLinkStream.listen(_handle);
  }

  void dispose() {
    _sub?.cancel();
    _sub = null;
    _started = false;
  }

  void _handle(Uri uri) {
    if (!_allowedHosts.contains(uri.host)) return;

    final ctx = rootNavigatorKey.currentContext;
    if (ctx == null) return;

    // Firebase email magic link: any URL Firebase recognizes (mode=signIn
    // + oobCode + apiKey) wins over slug routing. Email is round-tripped
    // via the continueUrl we set in sendMagicLink().
    if (FirebaseAuth.instance.isSignInWithEmailLink(uri.toString())) {
      final email = uri.queryParameters['email'];
      if (email == null || email.isEmpty) return;
      ctx.read<AuthCubit>().signInWithEmailLink(
            email: email,
            link: uri.toString(),
          );
      return;
    }

    final segments = uri.pathSegments.where((s) => s.isNotEmpty).toList();
    if (segments.isEmpty) return;

    final first = segments.first;
    if (_reservedPaths.contains(first)) return;

    ctx.go('/business/$first');
  }
}
