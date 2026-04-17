// lib/features/notifications/presentation/screens/notifications_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../shared/widgets/empty_state.dart';

class _NotificationItem {
  final IconData icon;
  final Color color;
  final String title;
  final String message;
  final String timeAgo;

  const _NotificationItem({
    required this.icon,
    required this.color,
    required this.title,
    required this.message,
    required this.timeAgo,
  });
}

const _mockNotifications = <_NotificationItem>[
  _NotificationItem(
    icon: Icons.check_circle_rounded,
    color: AppColors.success,
    title: 'Reserva confirmada',
    message: 'Tu reserva en Barbería Elite para el 20 de abril ha sido confirmada.',
    timeAgo: 'Hace 5 min',
  ),
  _NotificationItem(
    icon: Icons.calendar_today_rounded,
    color: AppColors.info,
    title: 'Recordatorio de cita',
    message: 'Tienes una cita mañana a las 10:00 AM en Studio Nails.',
    timeAgo: 'Hace 1 hora',
  ),
  _NotificationItem(
    icon: Icons.notifications_rounded,
    color: AppColors.warning,
    title: 'Horario actualizado',
    message: 'Spa Relax ha modificado su horario de atención. Revisa los cambios.',
    timeAgo: 'Hace 3 horas',
  ),
  _NotificationItem(
    icon: Icons.star_rounded,
    color: AppColors.accent,
    title: 'Nuevo negocio disponible',
    message: 'Dental Care se ha unido a Turnly. ¡Agenda tu primera cita!',
    timeAgo: 'Ayer',
  ),
];

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final notifications = _mockNotifications;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notificaciones'),
      ),
      body: notifications.isEmpty
          ? const EmptyState(
              icon: Icons.notifications_off_rounded,
              title: 'Sin notificaciones',
              subtitle: 'Cuando recibas notificaciones, aparecerán aquí.',
            )
          : ListView.separated(
              padding: const EdgeInsets.all(20),
              itemCount: notifications.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                final item = notifications[index];
                return _NotificationCard(item: item)
                    .animate()
                    .fadeIn(
                      duration: 350.ms,
                      delay: (60 * index).ms,
                    )
                    .slideX(begin: 0.03, end: 0);
              },
            ),
    );
  }
}

class _NotificationCard extends StatelessWidget {
  final _NotificationItem item;

  const _NotificationCard({required this.item});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: IntrinsicHeight(
        child: Row(
          children: [
            // Colored left border accent
            Container(
              width: 4,
              decoration: BoxDecoration(
                color: item.color,
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(16),
                  bottomLeft: Radius.circular(16),
                ),
              ),
            ),

            // Content
            Expanded(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(14, 14, 16, 14),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Icon
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: item.color.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(
                        item.icon,
                        color: item.color,
                        size: 20,
                      ),
                    ),
                    const SizedBox(width: 12),

                    // Text content
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  item.title,
                                  style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                              ),
                              Text(
                                item.timeAgo,
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: AppColors.textTertiary,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            item.message,
                            style: const TextStyle(
                              fontSize: 13,
                              color: AppColors.textSecondary,
                              height: 1.4,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
