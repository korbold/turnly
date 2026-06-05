// lib/features/reservations/data/dtos/reservation_dto.dart
import '../../domain/entities/reservation.dart';
import '../../domain/enums/reservation_status.dart';

class ReservationDto {
  final Map<String, dynamic> json;

  ReservationDto(this.json);

  Reservation toEntity() {
    final service = json['service'] as Map<String, dynamic>?;
    final client = json['client'] as Map<String, dynamic>?;
    final tenant = json['tenant'] as Map<String, dynamic>?;
    final clientResource = json['client_resource'] as Map<String, dynamic>?;

    // Two response shapes share this DTO:
    //  1) full reservation row (GET /client/reservations/{id}) — uses `id` + `service_id`
    //  2) booking summary (POST /public/tenants/{slug}/book) — uses
    //     `reservation_id` and exposes the first picked service via `items[]`.
    final items = json['items'] as List<dynamic>?;
    final firstItem = (items != null && items.isNotEmpty)
        ? items.first as Map<String, dynamic>
        : null;

    final id = (json['id'] ?? json['reservation_id']) as String;
    final serviceId = (json['service_id'] ?? firstItem?['service_id']) as String?;

    return Reservation(
      id: id,
      clientResourceId: json['client_resource_id'] as String?,
      serviceId: serviceId ?? '',
      assignedTo: json['assigned_to'] as String?,
      scheduledAt: DateTime.parse(json['scheduled_at'] as String).toLocal(),
      estimatedEnd: json['estimated_end'] != null
          ? DateTime.parse(json['estimated_end'] as String).toLocal()
          : null,
      status: ReservationStatus.fromString(json['status'] as String),
      notes: json['notes'] as String?,
      clientResourceLabel: clientResource?['label'] as String? ??
          clientResource?['plate'] as String?,
      serviceName: (service?['name'] as String?) ??
          (firstItem?['label'] as String?),
      servicePrice: service?['price']?.toString() ??
          firstItem?['unit_price']?.toString(),
      clientName: client?['name'] as String?,
      tenantName: tenant?['name'] as String?,
      tenantSlug: tenant?['slug'] as String?,
      cancellationHours: tenant?['cancellation_hours'] as int? ?? 1,
      clientRescheduledAt: json['client_rescheduled_at'] != null
          ? DateTime.parse(json['client_rescheduled_at'] as String).toLocal()
          : null,
      paymentStatus: (json['payment_status'] as String?) ?? 'unpaid',
      paymentMethod: json['payment_method'] as String?,
      paidAt: json['paid_at'] != null
          ? DateTime.parse(json['paid_at'] as String).toLocal()
          : null,
      paymentReference: json['payment_reference'] as String?,
      paymentBank: json['payment_bank'] as String?,
    );
  }
}
