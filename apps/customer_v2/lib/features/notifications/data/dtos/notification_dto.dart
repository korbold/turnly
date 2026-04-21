// lib/features/notifications/data/dtos/notification_dto.dart
import '../../domain/entities/app_notification.dart';

class NotificationDto {
  final Map<String, dynamic> json;

  NotificationDto(this.json);

  AppNotification toEntity() {
    return AppNotification(
      id: json['id'] as String,
      type: json['type'] as String? ?? '',
      title: json['title'] as String? ?? '',
      body: json['body'] as String? ?? '',
      actionType: json['action_type'] as String?,
      actionId: json['action_id'] as String?,
      tenantId: json['tenant_id'] as String?,
      tenantName: json['tenant_name'] as String?,
      icon: json['icon'] as String?,
      readAt: json['read_at'] != null
          ? DateTime.parse(json['read_at'] as String).toLocal()
          : null,
      createdAt: DateTime.parse(json['created_at'] as String).toLocal(),
    );
  }
}
