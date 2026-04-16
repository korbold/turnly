import 'package:equatable/equatable.dart';

class AvailabilitySlot extends Equatable {
  final int id;
  final int dayOfWeek;
  final String startTime;
  final String endTime;
  final int maxConcurrent;
  final bool isActive;

  const AvailabilitySlot({
    required this.id,
    required this.dayOfWeek,
    required this.startTime,
    required this.endTime,
    required this.maxConcurrent,
    required this.isActive,
  });

  @override
  List<Object?> get props => [id];
}

class AvailabilityBlock extends Equatable {
  final int id;
  final String date;
  final String? startTime;
  final String? endTime;
  final String? reason;
  final DateTime createdAt;

  const AvailabilityBlock({
    required this.id,
    required this.date,
    this.startTime,
    this.endTime,
    this.reason,
    required this.createdAt,
  });

  @override
  List<Object?> get props => [id];
}
