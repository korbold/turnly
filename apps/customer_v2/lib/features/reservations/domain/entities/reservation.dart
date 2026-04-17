// lib/features/reservations/domain/entities/reservation.dart
import 'package:equatable/equatable.dart';
import '../enums/reservation_status.dart';

class Reservation extends Equatable {
  final String id;
  final String? clientResourceId;
  final String serviceId;
  final String? assignedTo;
  final DateTime scheduledAt;
  final DateTime? estimatedEnd;
  final ReservationStatus status;
  final String? notes;
  final String? clientResourceLabel;
  final String? serviceName;
  final String? servicePrice;
  final String? clientName;
  final String? tenantName;
  final String? tenantSlug;
  final int cancellationHours;

  const Reservation({
    required this.id,
    this.clientResourceId,
    required this.serviceId,
    this.assignedTo,
    required this.scheduledAt,
    this.estimatedEnd,
    required this.status,
    this.notes,
    this.clientResourceLabel,
    this.serviceName,
    this.servicePrice,
    this.clientName,
    this.tenantName,
    this.tenantSlug,
    this.cancellationHours = 1,
  });

  bool get canCancel {
    if (!status.isUpcoming) return false;
    final deadline = scheduledAt.subtract(Duration(hours: cancellationHours));
    return DateTime.now().isBefore(deadline);
  }

  @override
  List<Object?> get props => [id];
}
