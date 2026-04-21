// lib/features/notifications/domain/entities/app_notification.dart
import 'package:equatable/equatable.dart';

class AppNotification extends Equatable {
  final String id;
  final String type;
  final String title;
  final String body;
  final String? actionType;
  final String? actionId;
  final String? tenantId;
  final String? tenantName;
  final String? icon;
  final DateTime? readAt;
  final DateTime createdAt;

  const AppNotification({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    this.actionType,
    this.actionId,
    this.tenantId,
    this.tenantName,
    this.icon,
    this.readAt,
    required this.createdAt,
  });

  bool get isRead => readAt != null;

  @override
  List<Object?> get props => [id];
}
