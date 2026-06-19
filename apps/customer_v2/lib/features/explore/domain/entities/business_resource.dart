// lib/features/explore/domain/entities/business_resource.dart
import 'package:equatable/equatable.dart';

class BusinessResource extends Equatable {
  final String id;
  final String name;
  final String type; // 'physical' | 'person'
  final String? employeeName;
  final String? employeePhotoUrl;

  const BusinessResource({
    required this.id,
    required this.name,
    required this.type,
    this.employeeName,
    this.employeePhotoUrl,
  });

  @override
  List<Object?> get props => [id];
}
