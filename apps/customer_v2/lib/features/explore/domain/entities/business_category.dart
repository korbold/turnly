// lib/features/explore/domain/entities/business_category.dart
import 'dart:ui';

class BusinessCategory {
  final String slug;
  final String name;
  final String emoji;
  final Color color;
  final String description;

  const BusinessCategory({
    required this.slug,
    required this.name,
    required this.emoji,
    required this.color,
    required this.description,
  });
}
