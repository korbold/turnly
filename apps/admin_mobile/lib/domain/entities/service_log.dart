import 'package:equatable/equatable.dart';

enum PaymentMethod {
  cash,
  card,
  transfer,
  other;

  String get apiValue {
    switch (this) {
      case PaymentMethod.cash:
        return 'cash';
      case PaymentMethod.card:
        return 'card';
      case PaymentMethod.transfer:
        return 'transfer';
      case PaymentMethod.other:
        return 'other';
    }
  }

  static PaymentMethod fromApi(String value) {
    switch (value) {
      case 'cash':
        return PaymentMethod.cash;
      case 'card':
        return PaymentMethod.card;
      case 'transfer':
        return PaymentMethod.transfer;
      case 'other':
        return PaymentMethod.other;
      default:
        throw ArgumentError('Unknown PaymentMethod: $value');
    }
  }
}

class ServiceLog extends Equatable {
  final int id;
  final int clientResourceId;
  final int serviceId;
  final int? reservationId;
  final int attendedBy;
  final int createdBy;
  final DateTime startedAt;
  final DateTime? finishedAt;
  final double priceCharged;
  final PaymentMethod paymentMethod;
  final String status;
  final String? notes;
  final String logDate;
  final DateTime createdAt;
  final String? clientResourcePlate;
  final String? clientResourceBrand;
  final String? serviceName;
  final String? attendantName;

  const ServiceLog({
    required this.id,
    required this.clientResourceId,
    required this.serviceId,
    this.reservationId,
    required this.attendedBy,
    required this.createdBy,
    required this.startedAt,
    this.finishedAt,
    required this.priceCharged,
    required this.paymentMethod,
    required this.status,
    this.notes,
    required this.logDate,
    required this.createdAt,
    this.clientResourcePlate,
    this.clientResourceBrand,
    this.serviceName,
    this.attendantName,
  });

  @override
  List<Object?> get props => [id];
}

class DailySummary extends Equatable {
  final int totalWashes;
  final double totalRevenue;
  final Map<String, dynamic> byPaymentMethod;
  final Map<String, dynamic> byStatus;

  const DailySummary({
    required this.totalWashes,
    required this.totalRevenue,
    required this.byPaymentMethod,
    required this.byStatus,
  });

  @override
  List<Object?> get props => [
        totalWashes,
        totalRevenue,
        byPaymentMethod,
        byStatus,
      ];
}
