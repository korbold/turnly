import '../../../domain/entities/service_log.dart';

ServiceLog mapServiceLog(Map<String, dynamic> json) {
  return ServiceLog(
    id: json['id'] as int,
    clientResourceId: json['client_resource_id'] as int,
    serviceId: json['service_id'] as int,
    reservationId: json['reservation_id'] as int?,
    attendedBy: json['attended_by'] as int,
    createdBy: json['created_by'] as int,
    startedAt: DateTime.parse(json['started_at'] as String),
    finishedAt: json['finished_at'] != null
        ? DateTime.parse(json['finished_at'] as String)
        : null,
    priceCharged: (json['price_charged'] as num).toDouble(),
    paymentMethod: PaymentMethod.fromApi(json['payment_method'] as String),
    status: json['status'] as String,
    notes: json['notes'] as String?,
    logDate: json['log_date'] as String,
    createdAt: DateTime.parse(json['created_at'] as String),
    clientResourcePlate: json['client_resource']?['plate'] as String? ??
        json['client_resource_plate'] as String?,
    clientResourceBrand: json['client_resource']?['brand'] as String? ??
        json['client_resource_brand'] as String?,
    serviceName:
        json['service']?['name'] as String? ?? json['service_name'] as String?,
    attendantName: json['attendant']?['name'] as String? ??
        json['attendant_name'] as String?,
  );
}

DailySummary mapDailySummary(Map<String, dynamic> json) {
  return DailySummary(
    totalWashes: json['total_washes'] as int? ?? 0,
    totalRevenue: (json['total_revenue'] as num?)?.toDouble() ?? 0.0,
    byPaymentMethod:
        json['by_payment_method'] as Map<String, dynamic>? ?? {},
    byStatus: json['by_status'] as Map<String, dynamic>? ?? {},
  );
}
