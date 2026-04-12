import '../enums/payment_method.dart';

class ServiceLog {
  final String id;
  final String clientResourceId;
  final String serviceId;
  final String? reservationId;
  final String attendedBy;
  final DateTime startedAt;
  final DateTime? finishedAt;
  final double priceCharged;
  final PaymentMethod paymentMethod;
  final String status; // in_progress, completed
  final String? notes;
  final String logDate;
  // Joined data
  final String? vehiclePlate;
  final String? vehicleBrand;
  final String? serviceName;
  final String? attendantName;

  const ServiceLog({
    required this.id,
    required this.clientResourceId,
    required this.serviceId,
    this.reservationId,
    required this.attendedBy,
    required this.startedAt,
    this.finishedAt,
    required this.priceCharged,
    required this.paymentMethod,
    required this.status,
    this.notes,
    required this.logDate,
    this.vehiclePlate,
    this.vehicleBrand,
    this.serviceName,
    this.attendantName,
  });

  bool get isCompleted => status == 'completed';
  bool get isInProgress => status == 'in_progress';
}
