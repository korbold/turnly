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
  // Pago — runs on a track separate from the lifecycle status. A booking
  // can be `completed` while still `unpaid` (typical car-wash pickup),
  // or paid upfront (spa prepay). Customer screen renders these as a
  // read-only badge so they know what to expect at the counter.
  final String paymentStatus; // 'unpaid' | 'paid'
  final String? paymentMethod; // 'cash' | 'card' | 'transfer'
  final DateTime? paidAt;
  final String? paymentReference;

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
    this.paymentStatus = 'unpaid',
    this.paymentMethod,
    this.paidAt,
    this.paymentReference,
  });

  bool get isPaid => paymentStatus == 'paid';

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
