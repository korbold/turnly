// lib/features/reservations/domain/enums/reservation_status.dart
import 'package:flutter/material.dart';

enum ReservationStatus {
  pending,
  confirmed,
  checkedIn,
  inProgress,
  completed,
  cancelled,
  noShow;

  static ReservationStatus fromString(String value) {
    return switch (value) {
      'pending' => ReservationStatus.pending,
      'confirmed' => ReservationStatus.confirmed,
      'checked_in' => ReservationStatus.checkedIn,
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
    ReservationStatus.checkedIn => 'Revisando',
    ReservationStatus.inProgress => 'En progreso',
    ReservationStatus.completed => 'Completada',
    ReservationStatus.cancelled => 'Cancelada',
    ReservationStatus.noShow => 'No asistio',
  };

  /// Foreground color (text + dot) — Turnly Design System status palette.
  Color get color => switch (this) {
    ReservationStatus.pending => const Color(0xFFB47114),
    ReservationStatus.confirmed => const Color(0xFF1666BF),
    ReservationStatus.checkedIn => const Color(0xFFB45309),
    ReservationStatus.inProgress => const Color(0xFF1A56D6),
    ReservationStatus.completed => const Color(0xFF0B7A44),
    ReservationStatus.cancelled => const Color(0xFFA91D2C),
    ReservationStatus.noShow => const Color(0xFF4B5462),
  };

  /// Soft background color for pills.
  Color get backgroundColor => switch (this) {
    ReservationStatus.pending => const Color(0xFFFFF6E0),
    ReservationStatus.confirmed => const Color(0xFFE4F1FE),
    ReservationStatus.checkedIn => const Color(0xFFFFEDD5),
    ReservationStatus.inProgress => const Color(0xFFDCE8FF),
    ReservationStatus.completed => const Color(0xFFE8F8F0),
    ReservationStatus.cancelled => const Color(0xFFFCE9EB),
    ReservationStatus.noShow => const Color(0xFFEEF0F3),
  };

  /// Active states where the booking is still "alive" on the schedule —
  /// used by the listing screen to bucket between upcoming and history.
  bool get isUpcoming =>
      this == pending ||
      this == confirmed ||
      this == checkedIn ||
      this == inProgress;

  /// Self-service window for the customer. Once the negocio confirma la
  /// llegada (checked_in) or arranca el servicio (in_progress) el
  /// cliente ya no puede cancelar ni reagendar desde la app — el
  /// backend rechaza la transición y el botón pierde sentido. Lo
  /// dejamos visible sólo para pending + confirmed.
  bool get allowsCustomerEdit =>
      this == pending || this == confirmed;
}
