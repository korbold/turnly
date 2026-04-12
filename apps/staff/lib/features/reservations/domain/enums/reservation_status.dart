import 'package:flutter/material.dart';

enum ReservationStatus {
  pending,
  confirmed,
  inProgress,
  completed,
  cancelled,
  noShow;

  static ReservationStatus fromString(String value) {
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
        return ReservationStatus.pending;
    }
  }

  String get label {
    switch (this) {
      case ReservationStatus.pending:
        return 'Pendiente';
      case ReservationStatus.confirmed:
        return 'Confirmada';
      case ReservationStatus.inProgress:
        return 'En progreso';
      case ReservationStatus.completed:
        return 'Completada';
      case ReservationStatus.cancelled:
        return 'Cancelada';
      case ReservationStatus.noShow:
        return 'No asistió';
    }
  }

  Color get color {
    switch (this) {
      case ReservationStatus.pending:
        return const Color(0xFFF59E0B); // amber
      case ReservationStatus.confirmed:
        return const Color(0xFF3B82F6); // blue
      case ReservationStatus.inProgress:
        return const Color(0xFF8B5CF6); // purple
      case ReservationStatus.completed:
        return const Color(0xFF10B981); // green
      case ReservationStatus.cancelled:
        return const Color(0xFFEF4444); // red
      case ReservationStatus.noShow:
        return const Color(0xFF6B7280); // gray
    }
  }
}
