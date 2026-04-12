import '../../domain/entities/reservation.dart';
import '../../domain/enums/reservation_status.dart';

class ReservationDto {
  final String id;
  final String clientResourceId;
  final String serviceId;
  final String? assignedTo;
  final String scheduledAt;
  final String estimatedEnd;
  final String status;
  final String? notes;
  final Map<String, dynamic>? clientResource;
  final Map<String, dynamic>? service;
  final Map<String, dynamic>? client;

  ReservationDto({
    required this.id,
    required this.clientResourceId,
    required this.serviceId,
    this.assignedTo,
    required this.scheduledAt,
    required this.estimatedEnd,
    required this.status,
    this.notes,
    this.clientResource,
    this.service,
    this.client,
  });

  factory ReservationDto.fromJson(Map<String, dynamic> json) {
    return ReservationDto(
      id: json['id'] as String,
      clientResourceId: json['client_resource_id'] as String,
      serviceId: json['service_id'] as String,
      assignedTo: json['assigned_to'] as String?,
      scheduledAt: json['scheduled_at'] as String,
      estimatedEnd: json['estimated_end'] as String,
      status: json['status'] as String,
      notes: json['notes'] as String?,
      clientResource: json['client_resource'] as Map<String, dynamic>?,
      service: json['service'] as Map<String, dynamic>?,
      client: json['client'] as Map<String, dynamic>?,
    );
  }

  Reservation toEntity() => Reservation(
        id: id,
        clientResourceId: clientResourceId,
        serviceId: serviceId,
        assignedTo: assignedTo,
        scheduledAt: DateTime.parse(scheduledAt),
        estimatedEnd: DateTime.parse(estimatedEnd),
        status: ReservationStatus.fromString(status),
        notes: notes,
        clientResourceLabel: clientResource?['label'] as String?,
        serviceName: service?['name'] as String?,
        servicePrice: service?['price']?.toString(),
        clientName: client?['name'] as String?,
      );
}
