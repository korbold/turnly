// lib/features/notifications/domain/repositories/notification_repository.dart
import 'package:fpdart/fpdart.dart';
import '../../../../core/error/failures.dart';
import '../entities/app_notification.dart';

abstract class NotificationRepository {
  Future<Either<Failure, List<AppNotification>>> getAll({bool unreadOnly});
  Future<Either<Failure, int>> getUnreadCount();
  Future<Either<Failure, Unit>> markAsRead(String id);
  Future<Either<Failure, Unit>> markAllAsRead();
}
