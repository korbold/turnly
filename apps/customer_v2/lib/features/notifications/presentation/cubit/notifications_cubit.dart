// lib/features/notifications/presentation/cubit/notifications_cubit.dart
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/repositories/notification_repository.dart';
import 'notifications_state.dart';

class NotificationsCubit extends Cubit<NotificationsState> {
  final NotificationRepository _repository;

  NotificationsCubit(this._repository) : super(const NotificationsInitial());

  Future<void> loadNotifications() async {
    emit(const NotificationsLoading());
    final result = await _repository.getAll();
    result.fold(
      (failure) => emit(NotificationsError(failure.message)),
      (notifications) {
        final unreadCount = notifications.where((n) => !n.isRead).length;
        emit(NotificationsLoaded(notifications, unreadCount: unreadCount));
      },
    );
  }

  Future<void> markAsRead(String id) async {
    final result = await _repository.markAsRead(id);
    result.fold(
      (_) {},
      (_) => loadNotifications(),
    );
  }

  Future<void> markAllAsRead() async {
    final result = await _repository.markAllAsRead();
    result.fold(
      (_) {},
      (_) => loadNotifications(),
    );
  }
}
