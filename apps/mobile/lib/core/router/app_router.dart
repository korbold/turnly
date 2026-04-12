import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../storage/secure_storage.dart';
import '../../features/auth/presentation/screens/login_screen.dart';
import '../../features/auth/presentation/screens/register_screen.dart';
import '../../features/reservations/presentation/screens/reservations_screen.dart';
import '../../features/reservations/presentation/screens/create_reservation_screen.dart';
import '../../features/reservations/presentation/screens/reservation_detail_screen.dart';

final goRouter = GoRouter(
  initialLocation: '/login',
  redirect: (context, state) async {
    final token = await SecureStorage.getToken();
    final isAuthenticated = token != null;
    final isAuthRoute = state.matchedLocation == '/login' || state.matchedLocation == '/register';

    if (!isAuthenticated && !isAuthRoute) {
      return '/login';
    }
    if (isAuthenticated && isAuthRoute) {
      return '/reservations';
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
      builder: (context, state) => const PlaceholderScreen(text: 'Home'),
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
      builder: (context, state) => const PlaceholderScreen(text: 'Vehicles'),
    ),
    GoRoute(
      path: '/vehicles/:id/history',
      builder: (context, state) =>
          PlaceholderScreen(text: 'Vehicle History ${state.pathParameters['id']}'),
    ),
  ],
);

class PlaceholderScreen extends StatelessWidget {
  final String text;
  const PlaceholderScreen({super.key, required this.text});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(child: Text(text)),
    );
  }
}
