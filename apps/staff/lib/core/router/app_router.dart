import 'package:go_router/go_router.dart';
import '../storage/secure_storage.dart';
import '../../features/auth/presentation/screens/login_screen.dart';
import '../../features/reservations/presentation/screens/reservation_detail_screen.dart';
import '../../features/services/domain/entities/service.dart';
import '../../features/services/presentation/screens/service_form_screen.dart';
import '../../features/services/presentation/screens/services_screen.dart';
import '../../features/shell/presentation/screens/shell_screen.dart';
import '../../features/reports/presentation/screens/reports_screen.dart';
import '../../features/settings/presentation/screens/settings_screen.dart';
import '../../features/team/presentation/screens/team_screen.dart';
import '../../features/service_log/presentation/screens/register_service_screen.dart';

final goRouter = GoRouter(
  initialLocation: '/login',
  redirect: (context, state) async {
    final token = await SecureStorage.getToken();
    final isAuthenticated = token != null;
    final isAuthRoute = state.matchedLocation == '/login';

    if (!isAuthenticated && !isAuthRoute) {
      return '/login';
    }
    if (isAuthenticated && isAuthRoute) {
      return '/shell';
    }

    // Role-based guard for admin-only routes
    final adminOnlyPaths = ['/team', '/reports', '/settings'];
    if (isAuthenticated && adminOnlyPaths.contains(state.matchedLocation)) {
      final role = await SecureStorage.getRole();
      if (role != 'tenant_admin') {
        return '/shell';
      }
    }

    return null;
  },
  routes: [
    GoRoute(
      path: '/login',
      builder: (context, state) => const LoginScreen(),
    ),
    GoRoute(
      path: '/shell',
      builder: (context, state) => const ShellScreen(),
    ),
    // Routes pushed from navigation
    GoRoute(
      path: '/service-log/register',
      builder: (context, state) => const RegisterServiceScreen(),
    ),
    GoRoute(
      path: '/reservations/:id',
      builder: (context, state) => ReservationDetailScreen(
        reservationId: state.pathParameters['id']!,
      ),
    ),
    // Services routes
    GoRoute(
      path: '/services',
      builder: (context, state) => const ServicesScreen(),
    ),
    GoRoute(
      path: '/services/form',
      builder: (context, state) => ServiceFormScreen(
        service: state.extra as Service?,
      ),
    ),
    GoRoute(
      path: '/team',
      builder: (context, state) => const TeamScreen(),
    ),
    GoRoute(
      path: '/reports',
      builder: (context, state) => const ReportsScreen(),
    ),
    GoRoute(
      path: '/settings',
      builder: (context, state) => const SettingsScreen(),
    ),
  ],
);
