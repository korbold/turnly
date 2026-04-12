import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../storage/secure_storage.dart';

// Import placeholder screens - we'll create real ones in later tasks
// For now, create minimal placeholder screens

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
      return '/home';
    }
    return null;
  },
  routes: [
    GoRoute(
      path: '/login',
      builder: (context, state) => const PlaceholderScreen(text: 'Login'),
    ),
    GoRoute(
      path: '/register',
      builder: (context, state) => const PlaceholderScreen(text: 'Register'),
    ),
    GoRoute(
      path: '/home',
      builder: (context, state) => const PlaceholderScreen(text: 'Home'),
    ),
    GoRoute(
      path: '/reservations',
      builder: (context, state) => const PlaceholderScreen(text: 'Reservations'),
    ),
    GoRoute(
      path: '/reservations/create',
      builder: (context, state) => const PlaceholderScreen(text: 'Create Reservation'),
    ),
    GoRoute(
      path: '/reservations/:id',
      builder: (context, state) => PlaceholderScreen(text: 'Reservation ${state.pathParameters['id']}'),
    ),
    GoRoute(
      path: '/vehicles',
      builder: (context, state) => const PlaceholderScreen(text: 'Vehicles'),
    ),
    GoRoute(
      path: '/vehicles/:id/history',
      builder: (context, state) => PlaceholderScreen(text: 'Vehicle History ${state.pathParameters['id']}'),
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
