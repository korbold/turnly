// lib/app/router.dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../core/storage/secure_storage.dart';

// Uncomment when screens are created
// import '../features/onboarding/presentation/screens/onboarding_screen.dart';
// import '../features/auth/presentation/screens/login_screen.dart';
// import '../features/auth/presentation/screens/register_screen.dart';
// import '../features/home/presentation/screens/main_shell.dart';
// import '../features/explore/presentation/screens/explore_screen.dart';
// import '../features/business/presentation/screens/business_detail_screen.dart';
// import '../features/reservations/presentation/screens/reservations_screen.dart';
// import '../features/reservations/presentation/screens/create_reservation_screen.dart';
// import '../features/reservations/presentation/screens/reservation_detail_screen.dart';
// import '../features/profile/presentation/screens/profile_screen.dart';
// import '../features/resources/presentation/screens/resources_screen.dart';
// import '../features/resources/presentation/screens/add_resource_screen.dart';
// import '../features/resources/presentation/screens/resource_history_screen.dart';
// import '../features/favorites/presentation/screens/favorites_screen.dart';
// import '../features/notifications/presentation/screens/notifications_screen.dart';

final _rootNavigatorKey = GlobalKey<NavigatorState>();
// ignore: unused_element
final _shellNavigatorKey = GlobalKey<NavigatorState>();

final appRouter = GoRouter(
  navigatorKey: _rootNavigatorKey,
  initialLocation: '/login',
  redirect: (context, state) async {
    final token = await SecureStorage.getToken();
    final isAuthenticated = token != null;
    final isAuthRoute = state.matchedLocation == '/login' ||
        state.matchedLocation == '/register' ||
        state.matchedLocation == '/onboarding';

    if (!isAuthenticated && !isAuthRoute) return '/login';
    if (isAuthenticated && isAuthRoute) return '/home';
    return null;
  },
  routes: [
    // TODO: Uncomment routes when screens are created
    //
    // GoRoute(
    //   path: '/onboarding',
    //   builder: (context, state) => const OnboardingScreen(),
    // ),
    // GoRoute(
    //   path: '/login',
    //   builder: (context, state) => const LoginScreen(),
    // ),
    // GoRoute(
    //   path: '/register',
    //   builder: (context, state) => const RegisterScreen(),
    // ),
    //
    // // Main app shell with bottom nav
    // ShellRoute(
    //   navigatorKey: _shellNavigatorKey,
    //   builder: (context, state, child) => MainShell(child: child),
    //   routes: [
    //     GoRoute(
    //       path: '/home',
    //       pageBuilder: (context, state) => const NoTransitionPage(
    //         child: ExploreScreen(),
    //       ),
    //     ),
    //     GoRoute(
    //       path: '/reservations',
    //       pageBuilder: (context, state) => const NoTransitionPage(
    //         child: ReservationsScreen(),
    //       ),
    //     ),
    //     GoRoute(
    //       path: '/profile',
    //       pageBuilder: (context, state) => const NoTransitionPage(
    //         child: ProfileScreen(),
    //       ),
    //     ),
    //   ],
    // ),
    //
    // // Full-screen routes (outside shell)
    // GoRoute(
    //   path: '/business/:slug',
    //   builder: (context, state) => BusinessDetailScreen(
    //     slug: state.pathParameters['slug']!,
    //   ),
    // ),
    // GoRoute(
    //   path: '/reservations/create',
    //   builder: (context, state) {
    //     final extra = state.extra as Map<String, dynamic>?;
    //     return CreateReservationScreen(
    //       tenantSlug: extra?['tenantSlug'] as String? ?? '',
    //       serviceId: extra?['serviceId'] as String?,
    //     );
    //   },
    // ),
    // GoRoute(
    //   path: '/reservations/:id',
    //   builder: (context, state) => ReservationDetailScreen(
    //     reservationId: state.pathParameters['id']!,
    //   ),
    // ),
    // GoRoute(
    //   path: '/resources',
    //   builder: (context, state) => const ResourcesScreen(),
    // ),
    // GoRoute(
    //   path: '/resources/add',
    //   builder: (context, state) => const AddResourceScreen(),
    // ),
    // GoRoute(
    //   path: '/resources/:id/history',
    //   builder: (context, state) => ResourceHistoryScreen(
    //     resourceId: state.pathParameters['id']!,
    //     label: state.extra as String? ?? '',
    //   ),
    // ),
    // GoRoute(
    //   path: '/favorites',
    //   builder: (context, state) => const FavoritesScreen(),
    // ),
    // GoRoute(
    //   path: '/notifications',
    //   builder: (context, state) => const NotificationsScreen(),
    // ),

    // Temporary placeholder routes until screens are created
    GoRoute(
      path: '/login',
      builder: (context, state) => const Scaffold(
        body: Center(child: Text('Login - Coming soon')),
      ),
    ),
    GoRoute(
      path: '/home',
      builder: (context, state) => const Scaffold(
        body: Center(child: Text('Home - Coming soon')),
      ),
    ),
  ],
);
