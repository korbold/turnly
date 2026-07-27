// lib/features/home/presentation/screens/main_shell.dart
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/widgets/glass_surface.dart';
import '../../../reservations/presentation/cubit/reservations_cubit.dart';
import '../../../reservations/presentation/cubit/reservations_state.dart';

class MainShell extends StatelessWidget {
  final Widget child;

  const MainShell({super.key, required this.child});

  int _currentIndex(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    if (location.startsWith('/reservations')) return 1;
    if (location.startsWith('/profile')) return 2;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final index = _currentIndex(context);
    final primary = Theme.of(context).colorScheme.primary;

    final upcomingCount = context.select<ReservationsCubit, int>((cubit) {
      final state = cubit.state;
      if (state is ReservationsLoaded) {
        return state.reservations.where((r) => r.status.isUpcoming).length;
      }
      return 0;
    });

    return Scaffold(
      body: child,
      extendBody: true,
      bottomNavigationBar: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(28),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.12),
                  blurRadius: 24,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: GlassSurface(
              radius: 28,
              blur: 20,
              tint: AppColors.surface,
              tintOpacity: 0.72,
              borderOpacity: 0.5,
              highlight: false,
              child: SizedBox(
                    height: 64,
                    child: Row(
                      children: [
                    _NavItem(
                      icon: Icons.explore_outlined,
                      activeIcon: Icons.explore,
                      label: 'Explorar',
                      isActive: index == 0,
                      primaryColor: primary,
                      onTap: () => context.go('/home'),
                    ),
                    _NavItem(
                      icon: Icons.calendar_today_outlined,
                      activeIcon: Icons.calendar_today,
                      label: 'Reservas',
                      isActive: index == 1,
                      primaryColor: primary,
                      badgeCount: upcomingCount,
                      onTap: () => context.go('/reservations'),
                    ),
                    _NavItem(
                      icon: Icons.person_outline,
                      activeIcon: Icons.person,
                      label: 'Perfil',
                      isActive: index == 2,
                      primaryColor: primary,
                      onTap: () => context.go('/profile'),
                    ),
                      ],
                    ),
                  ),
            ),
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final IconData icon;
  final IconData activeIcon;
  final String label;
  final bool isActive;
  final Color primaryColor;
  final VoidCallback onTap;
  final int badgeCount;

  const _NavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.isActive,
    required this.primaryColor,
    required this.onTap,
    this.badgeCount = 0,
  });

  @override
  Widget build(BuildContext context) {
    final fg = isActive ? primaryColor : AppColors.textTertiary;
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Stack(
          alignment: Alignment.topCenter,
          children: [
            // Top bar indicator (4px brand color when active)
            if (isActive)
              Container(
                width: 36,
                height: 3,
                decoration: BoxDecoration(
                  color: primaryColor,
                  borderRadius: const BorderRadius.vertical(
                    bottom: Radius.circular(99),
                  ),
                ),
              ),
            // Icon + label
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Stack(
                    clipBehavior: Clip.none,
                    children: [
                      Icon(
                        isActive ? activeIcon : icon,
                        color: fg,
                        size: 22,
                      ),
                      if (badgeCount > 0)
                        Positioned(
                          right: -8,
                          top: -4,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 4,
                              vertical: 1,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.error,
                              borderRadius: BorderRadius.circular(99),
                            ),
                            constraints: const BoxConstraints(
                              minWidth: 16,
                              minHeight: 14,
                            ),
                            child: Text(
                              '$badgeCount',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 9,
                                fontWeight: FontWeight.w700,
                                height: 1.2,
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    label,
                    style: TextStyle(
                      color: fg,
                      fontSize: 10.5,
                      fontWeight: FontWeight.w600,
                      height: 1,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
