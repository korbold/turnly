// lib/app/router.dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../core/storage/secure_storage.dart';
import '../features/onboarding/presentation/screens/onboarding_screen.dart';
import '../features/auth/presentation/screens/login_screen.dart';
import '../features/home/presentation/screens/main_shell.dart';
import '../features/explore/presentation/screens/explore_screen.dart';
import '../features/business/presentation/screens/business_detail_screen.dart';
import '../features/reservations/presentation/screens/reservations_screen.dart';
import '../features/reservations/presentation/screens/create_reservation_screen.dart';
import '../features/reservations/presentation/screens/reservation_detail_screen.dart';
import '../features/profile/presentation/screens/profile_screen.dart';
import '../features/resources/presentation/screens/resources_screen.dart';
import '../features/explore/domain/entities/service.dart';
import '../features/resources/domain/entities/client_resource.dart';
import '../features/resources/presentation/screens/add_resource_screen.dart';
import '../features/resources/presentation/screens/resource_history_screen.dart';
import '../features/explore/presentation/screens/category_screen.dart';
import '../features/favorites/presentation/screens/favorites_screen.dart';
import '../features/notifications/presentation/screens/notifications_screen.dart';
import '../features/legal/presentation/screens/legal_screen.dart';
import '../features/shared/presentation/screens/not_found_screen.dart';
import '../features/terms/presentation/screens/terms_acceptance_screen.dart';

final rootNavigatorKey = GlobalKey<NavigatorState>();
final _shellNavigatorKey = GlobalKey<NavigatorState>();

// Web-only paths that must never be interpreted as a tenant slug. Mirrors
// the equivalent set in DeepLinkHandler so both code paths agree.
const _reservedWebPaths = <String>{
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
  'm',
  'accept-terms',
};

final appRouter = GoRouter(
  navigatorKey: rootNavigatorKey,
  initialLocation: '/login',
  errorBuilder: (context, state) => NotFoundScreen(
    attemptedUri: state.uri,
  ),
  redirect: (context, state) async {
    // Android App Links and iOS Universal Links can deliver a full
    // `https://dev.goturnly.com/<slug>` URL directly to go_router before
    // DeepLinkHandler ever sees it. Translate those into in-app routes
    // here so the user never lands on a "no routes for location" page.
    final loc = state.uri.toString();
    if (loc.startsWith('http://') || loc.startsWith('https://')) {
      final segments =
          state.uri.pathSegments.where((s) => s.isNotEmpty).toList();
      if (segments.isEmpty) {
        return '/home';
      }
      // Magic link path: AuthCubit consumes the token via
      // DeepLinkHandler; meanwhile, send the user to /login so they see
      // a stable surface while sign-in completes.
      if (segments.first == 'm' &&
          segments.length == 2 &&
          segments[1].length == 64) {
        return '/login';
      }
      if (_reservedWebPaths.contains(segments.first)) {
        return '/home';
      }
      return '/business/${segments.first}';
    }

    final token = await SecureStorage.getToken();
    final termsAccepted = await SecureStorage.getTermsAccepted();
    final isAuthenticated = token != null;
    final isAuthRoute = state.matchedLocation == '/login' ||
        state.matchedLocation == '/register' ||
        state.matchedLocation == '/onboarding';

    String? decision;
    if (!isAuthenticated && !isAuthRoute) {
      decision = '/login';
    } else if (isAuthenticated && !termsAccepted &&
        state.matchedLocation != '/accept-terms') {
      decision = '/accept-terms';
    } else if (isAuthenticated && termsAccepted && isAuthRoute) {
      decision = '/home';
    }
    return decision;
  },
  routes: [
    GoRoute(
      path: '/onboarding',
      builder: (context, state) => const OnboardingScreen(),
    ),
    GoRoute(
      path: '/login',
      builder: (context, state) => const LoginScreen(),
    ),
    GoRoute(
      path: '/register',
      // Passwordless: there's no separate register form anymore. The
      // login screen's magic link covers both new and returning users.
      redirect: (_, __) => '/login',
    ),
    GoRoute(
      // Legacy: kept so any in-flight deep links don't 404. Magic link
      // is the new verification surface; bounce to /login.
      path: '/verify-email',
      redirect: (_, __) => '/login',
    ),
    GoRoute(
      path: '/accept-terms',
      pageBuilder: (context, state) => CustomTransitionPage(
        child: const TermsAcceptanceScreen(),
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          final reducedMotion = MediaQuery.of(context).disableAnimations;
          if (reducedMotion) {
            return FadeTransition(opacity: animation, child: child);
          }
          return SlideTransition(
            position: Tween<Offset>(
              begin: const Offset(0, 1),
              end: Offset.zero,
            ).animate(CurvedAnimation(
              parent: animation,
              curve: const Cubic(0.32, 0.72, 0, 1),
            )),
            child: child,
          );
        },
        transitionDuration: const Duration(milliseconds: 320),
      ),
    ),

    // Main app shell with bottom nav
    ShellRoute(
      navigatorKey: _shellNavigatorKey,
      builder: (context, state, child) => MainShell(child: child),
      routes: [
        GoRoute(
          path: '/home',
          pageBuilder: (context, state) => const NoTransitionPage(
            child: ExploreScreen(),
          ),
        ),
        GoRoute(
          path: '/reservations',
          pageBuilder: (context, state) => const NoTransitionPage(
            child: ReservationsScreen(),
          ),
        ),
        GoRoute(
          path: '/profile',
          pageBuilder: (context, state) => const NoTransitionPage(
            child: ProfileScreen(),
          ),
        ),
      ],
    ),

    // Full-screen routes (outside shell)
    GoRoute(
      path: '/category/:type',
      builder: (context, state) => CategoryScreen(
        businessType: state.pathParameters['type']!,
      ),
    ),
    GoRoute(
      path: '/business/:slug',
      builder: (context, state) => BusinessDetailScreen(
        slug: state.pathParameters['slug']!,
      ),
    ),
    GoRoute(
      path: '/reservations/create',
      builder: (context, state) {
        final extra = state.extra as Map<String, dynamic>?;
        final customFields =
            (extra?['customFields'] as List<Map<String, dynamic>>?) ?? [];
        final services =
            (extra?['services'] as List<Service>?) ?? [];
        return CreateReservationScreen(
          tenantSlug: extra?['tenantSlug'] as String? ?? '',
          serviceId: extra?['serviceId'] as String?,
          services: services,
          customFields: customFields,
          businessType: extra?['businessType'] as String?,
        );
      },
    ),
    GoRoute(
      path: '/reservations/:id',
      builder: (context, state) => ReservationDetailScreen(
        reservationId: state.pathParameters['id']!,
      ),
    ),
    GoRoute(
      path: '/resources',
      builder: (context, state) => const ResourcesScreen(),
    ),
    GoRoute(
      path: '/resources/add',
      builder: (context, state) {
        final extra = state.extra;
        if (extra is Map<String, dynamic>) {
          return AddResourceScreen(
            customFields: (extra['customFields'] as List<Map<String, dynamic>>?) ?? const [],
            existingResource: extra['resource'] as ClientResource?,
            businessType: extra['businessType'] as String?,
          );
        }
        if (extra is List<Map<String, dynamic>>) {
          return AddResourceScreen(customFields: extra);
        }
        return const AddResourceScreen();
      },
    ),
    GoRoute(
      path: '/resources/:id/history',
      builder: (context, state) => ResourceHistoryScreen(
        resourceId: state.pathParameters['id']!,
        label: state.extra as String? ?? '',
      ),
    ),
    // GoRoute(
    //   path: '/favorites',
    //   builder: (context, state) => const FavoritesScreen(),
    // ),
    GoRoute(
      path: '/notifications',
      builder: (context, state) => const NotificationsScreen(),
    ),
    GoRoute(
      path: '/legal/terms',
      builder: (context, state) => const LegalScreen(type: LegalType.terms),
    ),
    GoRoute(
      path: '/legal/privacy',
      builder: (context, state) => const LegalScreen(type: LegalType.privacy),
    ),
  ],
);
