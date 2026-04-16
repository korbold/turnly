import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../shared/constants/colors.dart';

class AppBottomNavBar extends StatelessWidget {
  final int currentIndex;

  const AppBottomNavBar({super.key, required this.currentIndex});

  @override
  Widget build(BuildContext context) {
    return BottomAppBar(
      shape: const CircularNotchedRectangle(),
      notchMargin: 8,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _NavItem(
            icon: Icons.home_outlined,
            activeIcon: Icons.home,
            label: 'Inicio',
            isActive: currentIndex == 0,
            onTap: () => context.go('/dashboard'),
          ),
          _NavItem(
            icon: Icons.calendar_today_outlined,
            activeIcon: Icons.calendar_today,
            label: 'Reservas',
            isActive: currentIndex == 1,
            onTap: () => context.go('/reservations'),
          ),
          const SizedBox(width: 48), // Space for FAB
          _NavItem(
            icon: Icons.bar_chart_outlined,
            activeIcon: Icons.bar_chart,
            label: 'Reportes',
            isActive: currentIndex == 2,
            onTap: () => context.go('/reports'),
          ),
          _NavItem(
            icon: Icons.more_horiz,
            activeIcon: Icons.more_horiz,
            label: 'Mas',
            isActive: currentIndex == 3,
            onTap: () => _showMoreSheet(context),
          ),
        ],
      ),
    );
  }

  void _showMoreSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.textMuted,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 16),
            ListTile(
              leading: const Icon(Icons.people_outline),
              title: const Text('Clientes'),
              onTap: () {
                Navigator.pop(ctx);
                context.go('/clients');
              },
            ),
            ListTile(
              leading: const Icon(Icons.cleaning_services_outlined),
              title: const Text('Servicios'),
              onTap: () {
                Navigator.pop(ctx);
                context.go('/services');
              },
            ),
            ListTile(
              leading: const Icon(Icons.group_outlined),
              title: const Text('Equipo'),
              onTap: () {
                Navigator.pop(ctx);
                context.go('/team');
              },
            ),
            ListTile(
              leading: const Icon(Icons.settings_outlined),
              title: const Text('Configuracion'),
              onTap: () {
                Navigator.pop(ctx);
                context.go('/settings');
              },
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  static void showNewActionSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.textMuted,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 16),
            ListTile(
              leading: const Icon(Icons.calendar_month_outlined),
              title: const Text('Nueva Reserva'),
              onTap: () {
                Navigator.pop(ctx);
                context.go('/reservations/create');
              },
            ),
            ListTile(
              leading: const Icon(Icons.add_task),
              title: const Text('Registrar Servicio'),
              onTap: () {
                Navigator.pop(ctx);
                context.go('/service-logs/new');
              },
            ),
            ListTile(
              leading: const Icon(Icons.block),
              title: const Text('Bloquear Horario'),
              onTap: () {
                Navigator.pop(ctx);
                // TODO: implement block schedule
              },
            ),
            const SizedBox(height: 8),
          ],
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
  final VoidCallback onTap;

  const _NavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.isActive,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final color = isActive ? AppColors.primary : AppColors.textMuted;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(isActive ? activeIcon : icon, color: color, size: 24),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(fontSize: 11, color: color),
            ),
          ],
        ),
      ),
    );
  }
}
