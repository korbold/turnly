import 'package:equatable/equatable.dart';

class Service extends Equatable {
  final int id;
  final String name;
  final String? description;
  final double price;
  final bool isActive;
  final String? imageUrl;
  final int sortOrder;
  final DateTime createdAt;

  const Service({
    required this.id,
    required this.name,
    this.description,
    required this.price,
    required this.isActive,
    this.imageUrl,
    required this.sortOrder,
    required this.createdAt,
  });

  @override
  List<Object?> get props => [id];
}
