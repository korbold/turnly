import '../../domain/entities/service_log.dart';
import '../../domain/entities/daily_summary.dart';
import '../../domain/enums/payment_method.dart';

class ServiceLogDto {
  static ServiceLog fromJson(Map<String, dynamic> json) {
    final clientResource = json['client_resource'] as Map<String, dynamic>?;
    final service = json['service'] as Map<String, dynamic>?;
    final attendant = json['attendant'] as Map<String, dynamic>?;

    return ServiceLog(
      id: json['id'] as String,
      clientResourceId: json['client_resource_id'] as String,
      serviceId: json['service_id'] as String,
      reservationId: json['reservation_id'] as String?,
      attendedBy: json['attended_by'] as String,
      startedAt: DateTime.parse(json['started_at'] as String),
      finishedAt: json['finished_at'] != null ? DateTime.parse(json['finished_at'] as String) : null,
      priceCharged: double.parse(json['price_charged'].toString()),
      paymentMethod: PaymentMethod.fromString(json['payment_method'] as String),
      status: json['status'] as String,
      notes: json['notes'] as String?,
      logDate: json['log_date'] as String,
      vehiclePlate: clientResource?['plate'] as String?,
      vehicleBrand: clientResource?['brand'] as String?,
      serviceName: service?['name'] as String?,
      attendantName: attendant?['name'] as String?,
    );
  }
}

class DailySummaryDto {
  static DailySummary fromJson(Map<String, dynamic> json) {
    final byPayment = <String, PaymentSummary>{};
    final byPaymentJson = json['by_payment_method'] as Map<String, dynamic>?;
    if (byPaymentJson != null) {
      for (final entry in byPaymentJson.entries) {
        final data = entry.value;
        if (data is Map<String, dynamic>) {
          byPayment[entry.key] = PaymentSummary(
            count: (data['count'] as num?)?.toInt() ?? 0,
            total: (data['total'] as num?)?.toDouble() ?? 0,
          );
        }
      }
    }

    final byStatus = json['by_status'] as Map<String, dynamic>?;

    return DailySummary(
      totalWashes: (json['total_washes'] as num?)?.toInt() ?? 0,
      totalRevenue: (json['total_revenue'] as num?)?.toDouble() ?? 0,
      byPaymentMethod: byPayment,
      inProgress: (byStatus?['in_progress'] as num?)?.toInt() ?? 0,
      completed: (byStatus?['completed'] as num?)?.toInt() ?? 0,
    );
  }
}
