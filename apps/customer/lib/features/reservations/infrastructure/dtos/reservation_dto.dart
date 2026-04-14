import '../../domain/entities/reservation.dart';
import '../../domain/enums/reservation_status.dart';

class ReservationDto {
  final String id;
  final String? clientResourceId;
  final String serviceId;
  final String? assignedTo;
  final String scheduledAt;
  final String? estimatedEnd;
  final String status;
  final String? notes;
  final Map<String, dynamic>? clientResource;
  final Map<String, dynamic>? service;
  final Map<String, dynamic>? client;
  final Map<String, dynamic>? tenant;

  ReservationDto({
    required this.id,
    this.clientResourceId,
    required this.serviceId,
    this.assignedTo,
    required this.scheduledAt,
    this.estimatedEnd,
    required this.status,
    this.notes,
    this.clientResource,
    this.service,
    this.client,
    this.tenant,
  });

  factory ReservationDto.fromJson(Map<String, dynamic> json) {
    return ReservationDto(
      id: json['id'] as String,
      clientResourceId: json['client_resource_id'] as String?,
      serviceId: json['service_id'] as String,
      assignedTo: json['assigned_to'] as String?,
      scheduledAt: json['scheduled_at'] as String,
      estimatedEnd: json['estimated_end'] as String?,
      status: json['status'] as String,
      notes: json['notes'] as String?,
      clientResource: json['client_resource'] as Map<String, dynamic>?,
      service: json['service'] as Map<String, dynamic>?,
      client: json['client'] as Map<String, dynamic>?,
      tenant: json['tenant'] as Map<String, dynamic>?,
    );
  }

  Reservation toEntity() => Reservation(
        id: id,
        clientResourceId: clientResourceId,
        serviceId: serviceId,
        assignedTo: assignedTo,
        scheduledAt: DateTime.parse(scheduledAt),
        estimatedEnd: estimatedEnd != null ? DateTime.parse(estimatedEnd!) : null,
        status: ReservationStatus.fromString(status),
        notes: notes,
        clientResourceLabel: clientResource?['plate'] as String?,
        serviceName: service?['name'] as String?,
        servicePrice: service?['price']?.toString(),
        clientName: client?['name'] as String?,
        tenantName: tenant?['name'] as String?,
        cancellationHours: tenant?['cancellation_hours'] as int? ?? 1,
      );
}
