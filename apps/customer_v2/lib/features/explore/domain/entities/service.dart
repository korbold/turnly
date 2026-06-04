// lib/features/explore/domain/entities/service.dart
import 'package:equatable/equatable.dart';

class ServiceVariantOption extends Equatable {
  final String id;
  final String label;
  final double price;
  final int durationMin;
  final int sortOrder;

  const ServiceVariantOption({
    required this.id,
    required this.label,
    required this.price,
    required this.durationMin,
    this.sortOrder = 0,
  });

  @override
  List<Object?> get props => [id, label, price, durationMin, sortOrder];
}

class Service extends Equatable {
  final String id;
  final String name;
  final String? description;
  final double price;
  final int durationMinutes;
  final String? imageUrl;
  final List<ServiceVariantOption> variants;

  const Service({
    required this.id,
    required this.name,
    this.description,
    required this.price,
    required this.durationMinutes,
    this.imageUrl,
    this.variants = const [],
  });

  bool get hasVariants => variants.isNotEmpty;

  /// Lowest variant price when the catalog has size/type variants;
  /// otherwise the flat service price. Used by ServiceCard to show
  /// "Desde $X" in the picker.
  double get displayPrice {
    if (variants.isEmpty) return price;
    return variants.map((v) => v.price).reduce((a, b) => a < b ? a : b);
  }

  @override
  List<Object?> get props => [id];
}
