// lib/features/reservations/domain/entities/reservation_item.dart
import 'package:equatable/equatable.dart';

class ReservationItem extends Equatable {
  final String id;
  final String reservationId;
  final String itemType; // 'service_variant' | 'product'
  final String refId;
  final String label;
  final num qty;
  final num unitPrice;
  final num lineTotal;

  const ReservationItem({
    required this.id,
    required this.reservationId,
    required this.itemType,
    required this.refId,
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
      label: json['label'] as String,
      qty: (json['qty'] as num?) ?? 1,
      unitPrice: (json['unit_price'] as num?) ?? 0,
      lineTotal: (json['line_total'] as num?) ?? 0,
    );
  }

  @override
  List<Object?> get props => [id, reservationId, itemType, refId, label, qty, unitPrice, lineTotal];
}
