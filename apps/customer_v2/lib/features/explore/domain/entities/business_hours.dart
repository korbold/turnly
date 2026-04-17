// lib/features/explore/domain/entities/business_hours.dart
import 'package:equatable/equatable.dart';

class BusinessHours extends Equatable {
  final int dayOfWeek; // 0=Sunday, 6=Saturday
  final String dayName;
  final bool isOpen;
  final List<TimeRange> ranges;

  const BusinessHours({
    required this.dayOfWeek,
    required this.dayName,
    required this.isOpen,
    this.ranges = const [],
  });

  @override
  List<Object?> get props => [dayOfWeek];
}

class TimeRange extends Equatable {
  final String start; // "08:00"
  final String end;   // "18:00"

  const TimeRange({required this.start, required this.end});

  @override
  List<Object?> get props => [start, end];
}
