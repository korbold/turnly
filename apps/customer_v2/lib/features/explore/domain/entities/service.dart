// lib/features/explore/domain/entities/service.dart
import 'package:equatable/equatable.dart';

class Service extends Equatable {
  final String id;
  final String name;
  final String? description;
  final double price;
  final int durationMinutes;

  const Service({
    required this.id,
    required this.name,
    this.description,
    required this.price,
    required this.durationMinutes,
  });

  @override
  List<Object?> get props => [id];
}
