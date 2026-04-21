// lib/features/reservations/domain/enums/reservation_status.dart
import 'package:flutter/material.dart';

enum ReservationStatus {
  pending,
  confirmed,
  inProgress,
  completed,
  cancelled,
  noShow;

  static ReservationStatus fromString(String value) {
    return switch (value) {
      'pending' => ReservationStatus.pending,
      'confirmed' => ReservationStatus.confirmed,
      'in_progress' => ReservationStatus.inProgress,
      'completed' => ReservationStatus.completed,
      'cancelled' => ReservationStatus.cancelled,
      'no_show' => ReservationStatus.noShow,
      _ => ReservationStatus.pending,
    };
  }

  String get label => switch (this) {
    ReservationStatus.pending => 'Pendiente',
    ReservationStatus.confirmed => 'Confirmada',
    ReservationStatus.inProgress => 'En progreso',
    ReservationStatus.completed => 'Completada',
    ReservationStatus.cancelled => 'Cancelada',
    ReservationStatus.noShow => 'No asistio',
  };

  Color get color => switch (this) {
    ReservationStatus.pending => const Color(0xFFF59E0B),
    ReservationStatus.confirmed => const Color(0xFF3B82F6),
    ReservationStatus.inProgress => const Color(0xFF8B5CF6),
    ReservationStatus.completed => const Color(0xFF10B981),
    ReservationStatus.cancelled => const Color(0xFFEF4444),
    ReservationStatus.noShow => const Color(0xFF6B7280),
  };

  bool get isUpcoming => this == pending || this == confirmed || this == inProgress;
}
