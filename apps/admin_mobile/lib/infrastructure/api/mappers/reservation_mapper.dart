import '../../../domain/entities/reservation.dart';

Reservation mapReservation(Map<String, dynamic> json) {
  return Reservation(
    id: json['id'] as int,
    clientId: json['client_id'] as int,
    clientResourceId: json['client_resource_id'] as int,
    serviceId: json['service_id'] as int,
    assignedTo: json['assigned_to'] as int?,
    scheduledAt: DateTime.parse(json['scheduled_at'] as String),
    estimatedEnd: DateTime.parse(json['estimated_end'] as String),
    status: ReservationStatus.fromApi(json['status'] as String),
    notes: json['notes'] as String?,
    cancelledAt: json['cancelled_at'] != null
        ? DateTime.parse(json['cancelled_at'] as String)
        : null,
    cancelReason: json['cancel_reason'] as String?,
    createdBy: json['created_by'] as int,
    createdAt: DateTime.parse(json['created_at'] as String),
    clientResourceLabel: json['client_resource']?['plate'] as String? ??
        json['client_resource_label'] as String?,
    clientResourcePlate: json['client_resource']?['plate'] as String? ??
        json['client_resource_plate'] as String?,
    serviceName:
        json['service']?['name'] as String? ?? json['service_name'] as String?,
    servicePrice: json['service']?['price'] != null
        ? (json['service']['price'] as num).toDouble()
        : (json['service_price'] as num?)?.toDouble(),
    clientName:
        json['client']?['name'] as String? ?? json['client_name'] as String?,
    clientEmail:
        json['client']?['email'] as String? ?? json['client_email'] as String?,
  );
}

AvailableSlot mapAvailableSlot(Map<String, dynamic> json) {
  return AvailableSlot(
    start: DateTime.parse(json['start'] as String),
    end: DateTime.parse(json['end'] as String),
    available: json['available'] as int,
  );
}
