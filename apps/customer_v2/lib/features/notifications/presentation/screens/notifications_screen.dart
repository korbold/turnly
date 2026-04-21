// lib/features/notifications/presentation/screens/notifications_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/di/injection.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../../shared/widgets/shimmer_loader.dart';
import '../../domain/repositories/notification_repository.dart';
import '../cubit/notifications_cubit.dart';
import '../cubit/notifications_state.dart';
import '../widgets/notification_tile.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => NotificationsCubit(getIt<NotificationRepository>())..loadNotifications(),
      child: const _NotificationsView(),
    );
  }
}

class _NotificationsView extends StatelessWidget {
  const _NotificationsView();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notificaciones'),
        actions: [
          BlocBuilder<NotificationsCubit, NotificationsState>(
            builder: (context, state) {
              if (state is NotificationsLoaded && state.unreadCount > 0) {
                return TextButton(
                  onPressed: () => context.read<NotificationsCubit>().markAllAsRead(),
                  child: const Text('Marcar todas'),
                );
              }
              return const SizedBox.shrink();
            },
          ),
        ],
      ),
      body: BlocBuilder<NotificationsCubit, NotificationsState>(
        builder: (context, state) {
          if (state is NotificationsLoading || state is NotificationsInitial) {
            return Padding(
              padding: const EdgeInsets.all(20),
              child: ShimmerLoader.list(count: 5, itemHeight: 72),
            );
          }

          if (state is NotificationsError) {
            return EmptyState(
              icon: Icons.error_outline_rounded,
              title: 'Error al cargar notificaciones',
              subtitle: state.message,
              actionLabel: 'Reintentar',
              onAction: () => context.read<NotificationsCubit>().loadNotifications(),
            );
          }

          if (state is NotificationsLoaded) {
            if (state.notifications.isEmpty) {
              return const EmptyState(
                icon: Icons.notifications_off_rounded,
                title: 'Sin notificaciones',
                subtitle: 'Cuando recibas notificaciones, aparecerán aquí.',
              );
            }

            return RefreshIndicator(
              color: AppColors.accent,
              onRefresh: () async {
                context.read<NotificationsCubit>().loadNotifications();
              },
              child: ListView.separated(
                physics: const AlwaysScrollableScrollPhysics(
                  parent: BouncingScrollPhysics(),
                ),
                padding: const EdgeInsets.all(20),
                itemCount: state.notifications.length,
                separatorBuilder: (_, __) => const SizedBox(height: 12),
                itemBuilder: (context, index) {
                  final notification = state.notifications[index];
                  return NotificationTile(
                    notification: notification,
                    onTap: () {
                      if (!notification.isRead) {
                        context.read<NotificationsCubit>().markAsRead(notification.id);
                      }
                      if (notification.actionType == 'reservation_detail' &&
                          notification.actionId != null) {
                        context.push('/reservations/${notification.actionId}');
                      }
                    },
                  )
                      .animate()
                      .fadeIn(duration: 350.ms, delay: (60 * index).ms)
                      .slideX(begin: 0.03, end: 0);
                },
              ),
            );
          }

          return const SizedBox.shrink();
        },
      ),
    );
  }
}
