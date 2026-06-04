// lib/features/reservations/domain/entities/reservation_item.dart
import 'package:equatable/equatable.dart';

class ReservationItem extends Equatable {
  final String id;
  final String reservationId;
  final String itemType; // 'service_variant' | 'product'
  final String refId;
  /// Parent service for variant items. Backend exposes it so the editor
  /// can mark sibling variants as "already added" without an extra lookup.
  final String? serviceId;
  final String label;
  final num qty;
  final num unitPrice;
  final num lineTotal;

  const ReservationItem({
    required this.id,
    required this.reservationId,
    required this.itemType,
    required this.refId,
    this.serviceId,
    required this.label,
    required this.qty,
    required this.unitPrice,
    required this.lineTotal,
  });

  factory ReservationItem.fromJson(Map<String, dynamic> json) {
    return ReservationItem(
      id: json['id'] as String,
      reservationId: json['reservation_id'] as String,
      itemType: json['item_type'] as String,
      refId: json['ref_id'] as String,
      serviceId: json['service_id'] as String?,
      label: json['label'] as String,
      qty: (json['qty'] as num?) ?? 1,
      unitPrice: (json['unit_price'] as num?) ?? 0,
      lineTotal: (json['line_total'] as num?) ?? 0,
    );
  }

  @override
  List<Object?> get props => [id, reservationId, itemType, refId, serviceId, label, qty, unitPrice, lineTotal];
}
