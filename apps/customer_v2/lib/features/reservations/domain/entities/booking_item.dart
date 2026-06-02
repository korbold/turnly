// lib/features/reservations/domain/entities/booking_item.dart
import 'package:equatable/equatable.dart';

/// One service line the customer wants in their cart, captured at the
/// moment they add it from the business detail screen. Carries enough
/// metadata to render the cart locally (label, price, duration) and to
/// send `items[]` to POST /reservations.
class BookingItem extends Equatable {
  final String serviceId;
  final String? serviceVariantId; // optional until the picker exposes variants
  final String label; // service name (+ variant label when available)
  final double price;
  final int durationMin;
  final int qty;

  const BookingItem({
    required this.serviceId,
    this.serviceVariantId,
    required this.label,
    required this.price,
    required this.durationMin,
    this.qty = 1,
  });

  BookingItem copyWith({int? qty}) => BookingItem(
        serviceId: serviceId,
        serviceVariantId: serviceVariantId,
        label: label,
        price: price,
        durationMin: durationMin,
        qty: qty ?? this.qty,
      );

  double get lineTotal => price * qty;

  @override
  List<Object?> get props => [serviceId, serviceVariantId, label, price, durationMin, qty];
}
