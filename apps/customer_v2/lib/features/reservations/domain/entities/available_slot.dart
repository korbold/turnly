// lib/features/reservations/domain/entities/available_slot.dart
import 'package:equatable/equatable.dart';

class AvailableSlot extends Equatable {
  final DateTime start;
  final DateTime end;
  final int available;

  const AvailableSlot({
    required this.start,
    required this.end,
    required this.available,
  });

  bool get isAvailable => available > 0;

  @override
  List<Object?> get props => [start, end];
}
