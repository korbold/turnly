import 'package:equatable/equatable.dart';

enum ReservationStatus {
  pending,
  confirmed,
  inProgress,
  completed,
  cancelled,
  noShow;

  String get apiValue {
    switch (this) {
      case ReservationStatus.pending:
        return 'pending';
      case ReservationStatus.confirmed:
        return 'confirmed';
      case ReservationStatus.inProgress:
        return 'in_progress';
      case ReservationStatus.completed:
        return 'completed';
      case ReservationStatus.cancelled:
        return 'cancelled';
      case ReservationStatus.noShow:
        return 'no_show';
    }
  }

  static ReservationStatus fromApi(String value) {
    switch (value) {
      case 'pending':
        return ReservationStatus.pending;
      case 'confirmed':
        return ReservationStatus.confirmed;
      case 'in_progress':
        return ReservationStatus.inProgress;
      case 'completed':
        return ReservationStatus.completed;
      case 'cancelled':
        return ReservationStatus.cancelled;
      case 'no_show':
        return ReservationStatus.noShow;
      default:
        throw ArgumentError('Unknown ReservationStatus: $value');
    }
  }
}

enum ReservationAction {
  confirm,
  start,
  complete,
  cancel;

  String get apiValue {
    switch (this) {
      case ReservationAction.confirm:
        return 'confirm';
      case ReservationAction.start:
        return 'start';
      case ReservationAction.complete:
        return 'complete';
      case ReservationAction.cancel:
        return 'cancel';
    }
  }
}

class Reservation extends Equatable {
  final int id;
  final int clientId;
  final int clientResourceId;
  final int serviceId;
  final int? assignedTo;
  final DateTime scheduledAt;
  final DateTime estimatedEnd;
  final ReservationStatus status;
  final String? notes;
  final DateTime? cancelledAt;
  final String? cancelReason;
  final int createdBy;
  final DateTime createdAt;
  final String? clientResourceLabel;
  final String? clientResourcePlate;
  final String? serviceName;
  final double? servicePrice;
  final String? clientName;
  final String? clientEmail;

  const Reservation({
    required this.id,
    required this.clientId,
    required this.clientResourceId,
    required this.serviceId,
    this.assignedTo,
    required this.scheduledAt,
    required this.estimatedEnd,
    required this.status,
    this.notes,
    this.cancelledAt,
    this.cancelReason,
    required this.createdBy,
    required this.createdAt,
    this.clientResourceLabel,
    this.clientResourcePlate,
    this.serviceName,
    this.servicePrice,
    this.clientName,
    this.clientEmail,
  });

  @override
  List<Object?> get props => [id];
}

class AvailableSlot extends Equatable {
  final DateTime start;
  final DateTime end;
  final int available;

  const AvailableSlot({
    required this.start,
    required this.end,
    required this.available,
  });

  @override
  List<Object?> get props => [start, end, available];
}

class ReservationFilters extends Equatable {
  final DateTime? dateFrom;
  final DateTime? dateTo;
  final ReservationStatus? status;
  final int? serviceId;
  final int? page;

  const ReservationFilters({
    this.dateFrom,
    this.dateTo,
    this.status,
    this.serviceId,
    this.page,
  });

  @override
  List<Object?> get props => [dateFrom, dateTo, status, serviceId, page];
}
