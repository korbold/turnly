import 'package:go_router/go_router.dart';

import '../../injection.dart';
import '../../infrastructure/storage/secure_storage.dart';
import '../layout/app_shell.dart';
import '../pages/placeholder_page.dart';

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
      builder: (context, state) =>
          const PlaceholderPage(title: 'Iniciar Sesion'),
    ),
    GoRoute(
      path: '/register',
      builder: (context, state) =>
          const PlaceholderPage(title: 'Registrarse'),
    ),

    // Authenticated routes with shell
    ShellRoute(
      builder: (context, state, child) => AppShell(child: child),
      routes: [
        GoRoute(
          path: '/dashboard',
          builder: (context, state) =>
              const PlaceholderPage(title: 'Dashboard'),
        ),
        GoRoute(
          path: '/reservations',
          builder: (context, state) =>
              const PlaceholderPage(title: 'Reservas'),
          routes: [
            GoRoute(
              path: 'create',
              builder: (context, state) =>
                  const PlaceholderPage(title: 'Nueva Reserva'),
            ),
            GoRoute(
              path: ':id',
              builder: (context, state) => PlaceholderPage(
                title: 'Reserva #${state.pathParameters['id']}',
              ),
            ),
          ],
        ),
        GoRoute(
          path: '/service-logs',
          builder: (context, state) =>
              const PlaceholderPage(title: 'Registro de Servicios'),
          routes: [
            GoRoute(
              path: 'new',
              builder: (context, state) =>
                  const PlaceholderPage(title: 'Nuevo Registro'),
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
