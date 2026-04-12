import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../storage/secure_storage.dart';

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
    return null;
  },
  routes: [
    GoRoute(
      path: '/login',
      builder: (context, state) => const _PlaceholderScreen(text: 'Login'),
    ),
    GoRoute(
      path: '/shell',
      builder: (context, state) => const _PlaceholderScreen(text: 'Shell'),
    ),
  ],
);

class _PlaceholderScreen extends StatelessWidget {
  final String text;
  const _PlaceholderScreen({required this.text});

  @override
  Widget build(BuildContext context) {
    return Scaffold(body: Center(child: Text(text)));
  }
}
