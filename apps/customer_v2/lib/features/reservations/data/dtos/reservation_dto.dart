// lib/features/reservations/data/dtos/reservation_dto.dart
import '../../domain/entities/reservation.dart';
import '../../domain/enums/reservation_status.dart';

class ReservationDto {
  final Map<String, dynamic> json;

  ReservationDto(this.json);

  Reservation toEntity() {
    final service = json['service'] as Map<String, dynamic>?;
    final client = json['client'] as Map<String, dynamic>?;
    final tenant = json['tenant'] as Map<String, dynamic>?;
    final clientResource = json['client_resource'] as Map<String, dynamic>?;

    return Reservation(
      id: json['id'] as String,
      clientResourceId: json['client_resource_id'] as String?,
      serviceId: json['service_id'] as String,
      assignedTo: json['assigned_to'] as String?,
      scheduledAt: DateTime.parse(json['scheduled_at'] as String),
      estimatedEnd: json['estimated_end'] != null
          ? DateTime.parse(json['estimated_end'] as String)
          : null,
      status: ReservationStatus.fromString(json['status'] as String),
      notes: json['notes'] as String?,
      clientResourceLabel: clientResource?['label'] as String? ??
          clientResource?['plate'] as String?,
      serviceName: service?['name'] as String?,
      servicePrice: service?['price']?.toString(),
      clientName: client?['name'] as String?,
      tenantName: tenant?['name'] as String?,
      tenantSlug: tenant?['slug'] as String?,
      cancellationHours: tenant?['cancellation_hours'] as int? ?? 1,
    );
  }
}
