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
  /// Timestamp of the customer's reschedule action. Once set, the
  /// backend refuses any further customer-initiated reschedule on this
  /// reservation; the UI hides the button accordingly.
  final DateTime? clientRescheduledAt;

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
    this.clientRescheduledAt,
  });

  bool get canCancel {
    if (!status.isUpcoming) return false;
    final deadline = scheduledAt.subtract(Duration(hours: cancellationHours));
    return DateTime.now().isBefore(deadline);
  }

  /// Customers can reschedule once per booking. Same cancel-window
  /// applies — beyond that the backend rejects anyway.
  bool get canReschedule => canCancel && clientRescheduledAt == null;

  @override
  List<Object?> get props => [id];
}
