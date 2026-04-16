import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../shared/constants/colors.dart';
import 'bottom_nav_bar.dart';

class AppShell extends StatelessWidget {
  final Widget child;

  const AppShell({super.key, required this.child});

  int _currentIndex(BuildContext context) {
    final location = GoRouterState.of(context).uri.toString();
    if (location.startsWith('/dashboard')) return 0;
    if (location.startsWith('/reservations')) return 1;
    if (location.startsWith('/reports')) return 2;
    // "More" pages: clients, services, team, settings, service-logs
    return -1; // no tab highlighted
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: child,
      bottomNavigationBar: AppBottomNavBar(currentIndex: _currentIndex(context)),
      floatingActionButton: FloatingActionButton(
        onPressed: () => AppBottomNavBar.showNewActionSheet(context),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        shape: const CircleBorder(),
        child: const Icon(Icons.add),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,
    );
  }
}
