import '../../../domain/entities/service.dart';

Service mapService(Map<String, dynamic> json) {
  return Service(
    id: json['id'] as int,
    name: json['name'] as String,
    description: json['description'] as String?,
    price: (json['price'] as num).toDouble(),
    isActive: json['is_active'] as bool? ?? true,
    imageUrl: json['image_url'] as String?,
    sortOrder: json['sort_order'] as int? ?? 0,
    createdAt: DateTime.parse(json['created_at'] as String),
  );
}
