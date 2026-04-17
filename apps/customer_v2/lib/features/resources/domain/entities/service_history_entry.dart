// lib/features/resources/domain/entities/service_history_entry.dart
import 'package:equatable/equatable.dart';

class ServiceHistoryEntry extends Equatable {
  final String id;
  final String serviceName;
  final DateTime startedAt;
  final DateTime? finishedAt;
  final double priceCharged;
  final String paymentMethod;
  final String status;

  const ServiceHistoryEntry({
    required this.id,
    required this.serviceName,
    required this.startedAt,
    this.finishedAt,
    required this.priceCharged,
    required this.paymentMethod,
    required this.status,
  });

  @override
  List<Object?> get props => [id];
}
