import 'package:go_router/go_router.dart';
import '../storage/secure_storage.dart';
import '../../features/auth/presentation/screens/login_screen.dart';
import '../../features/auth/presentation/screens/register_screen.dart';
import '../../features/home/presentation/screens/home_screen.dart';
import '../../features/reservations/presentation/screens/reservations_screen.dart';
import '../../features/reservations/presentation/screens/create_reservation_screen.dart';
import '../../features/reservations/presentation/screens/reservation_detail_screen.dart';
import '../../features/vehicles/presentation/screens/vehicles_screen.dart';
import '../../features/vehicles/presentation/screens/add_vehicle_screen.dart';
import '../../features/vehicles/presentation/screens/vehicle_history_screen.dart';

final goRouter = GoRouter(
  initialLocation: '/login',
  redirect: (context, state) async {
    final token = await SecureStorage.getToken();
    final isAuthenticated = token != null;
    final isAuthRoute = state.matchedLocation == '/login' ||
        state.matchedLocation == '/register';

    if (!isAuthenticated && !isAuthRoute) {
      return '/login';
    }
    if (isAuthenticated && isAuthRoute) {
      return '/home';
    }
    return null;
  },
  routes: [
    GoRoute(
      path: '/login',
      builder: (context, state) => const LoginScreen(),
    ),
    GoRoute(
      path: '/register',
      builder: (context, state) => const RegisterScreen(),
    ),
    GoRoute(
      path: '/home',
      builder: (context, state) => const HomeScreen(),
    ),
    GoRoute(
      path: '/reservations',
      builder: (context, state) => const ReservationsScreen(),
    ),
    GoRoute(
      path: '/reservations/create',
      builder: (context, state) => const CreateReservationScreen(),
    ),
    GoRoute(
      path: '/reservations/:id',
      builder: (context, state) => ReservationDetailScreen(
        reservationId: state.pathParameters['id']!,
      ),
    ),
    GoRoute(
      path: '/vehicles',
      builder: (context, state) => const VehiclesScreen(),
    ),
    GoRoute(
      path: '/vehicles/add',
      builder: (context, state) => const AddVehicleScreen(),
    ),
    GoRoute(
      path: '/vehicles/:id/history',
      builder: (context, state) {
        final id = state.pathParameters['id']!;
        final plate = state.extra as String? ?? id;
        return VehicleHistoryScreen(vehicleId: id, plate: plate);
      },
    ),
  ],
);
