import 'package:go_router/go_router.dart';

import '../../injection.dart';
import '../../infrastructure/storage/secure_storage.dart';
import '../layout/app_shell.dart';
import '../pages/auth/login_page.dart';
import '../pages/auth/register_page.dart';
import '../pages/dashboard/dashboard_page.dart';
import '../pages/placeholder_page.dart';
import '../pages/reservations/reservations_page.dart';
import '../pages/reservations/reservation_detail_page.dart';
import '../pages/reservations/create_reservation_page.dart';
import '../pages/service_logs/service_log_page.dart';
import '../pages/service_logs/new_service_log_page.dart';

final appRouter = GoRouter(
  initialLocation: '/login',
  redirect: (context, state) async {
    final token = await getIt<SecureStorageService>().getToken();
    final isAuth = token != null;
    final isAuthRoute = state.uri.toString() == '/login' ||
        state.uri.toString() == '/register';

    if (!isAuth && !isAuthRoute) return '/login';
    if (isAuth && isAuthRoute) return '/dashboard';
    return null;
  },
  routes: [
    // Auth routes (no shell)
    GoRoute(
      path: '/login',
      builder: (context, state) => const LoginPage(),
    ),
    GoRoute(
      path: '/register',
      builder: (context, state) => const RegisterPage(),
    ),

    // Authenticated routes with shell
    ShellRoute(
      builder: (context, state, child) => AppShell(child: child),
      routes: [
        GoRoute(
          path: '/dashboard',
          builder: (context, state) => const DashboardPage(),
        ),
        GoRoute(
          path: '/reservations',
          builder: (context, state) => const ReservationsPage(),
          routes: [
            GoRoute(
              path: 'create',
              builder: (context, state) => const CreateReservationPage(),
            ),
            GoRoute(
              path: ':id',
              builder: (context, state) => ReservationDetailPage(
                reservationId: state.pathParameters['id']!,
              ),
            ),
          ],
        ),
        GoRoute(
          path: '/service-logs',
          builder: (context, state) => const ServiceLogPage(),
          routes: [
            GoRoute(
              path: 'new',
              builder: (context, state) => const NewServiceLogPage(),
            ),
          ],
        ),
        GoRoute(
          path: '/clients',
          builder: (context, state) =>
              const PlaceholderPage(title: 'Clientes'),
          routes: [
            GoRoute(
              path: ':id',
              builder: (context, state) => PlaceholderPage(
                title: 'Cliente #${state.pathParameters['id']}',
              ),
            ),
          ],
        ),
        GoRoute(
          path: '/services',
          builder: (context, state) =>
              const PlaceholderPage(title: 'Servicios'),
        ),
        GoRoute(
          path: '/team',
          builder: (context, state) =>
              const PlaceholderPage(title: 'Equipo'),
        ),
        GoRoute(
          path: '/reports',
          builder: (context, state) =>
              const PlaceholderPage(title: 'Reportes'),
        ),
        GoRoute(
          path: '/settings',
          builder: (context, state) =>
              const PlaceholderPage(title: 'Configuracion'),
        ),
        GoRoute(
          path: '/super-admin',
          builder: (context, state) =>
              const PlaceholderPage(title: 'Super Admin'),
          routes: [
            GoRoute(
              path: 'tenants',
              builder: (context, state) =>
                  const PlaceholderPage(title: 'Tenants'),
            ),
            GoRoute(
              path: 'users',
              builder: (context, state) =>
                  const PlaceholderPage(title: 'Usuarios'),
            ),
          ],
        ),
      ],
    ),
  ],
);
