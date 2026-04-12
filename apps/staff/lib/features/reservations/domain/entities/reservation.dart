import '../enums/reservation_status.dart';

class Reservation {
  final String id;
  final String clientResourceId;
  final String serviceId;
  final String? assignedTo;
  final DateTime scheduledAt;
  final DateTime estimatedEnd;
  final ReservationStatus status;
  final String? notes;
  final String? vehiclePlate;
  final String? vehicleBrand;
  final String? serviceName;
  final String? servicePrice;
  final String? clientName;

  const Reservation({
    required this.id,
    required this.clientResourceId,
    required this.serviceId,
    this.assignedTo,
    required this.scheduledAt,
    required this.estimatedEnd,
    required this.status,
    this.notes,
    this.vehiclePlate,
    this.vehicleBrand,
    this.serviceName,
    this.servicePrice,
    this.clientName,
  });
}
