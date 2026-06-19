// lib/features/explore/domain/entities/business.dart
import 'package:equatable/equatable.dart';
import 'service.dart';
import 'business_hours.dart';
import 'business_resource.dart';

class Business extends Equatable {
  final String id;
  final String slug;
  final String name;
  final String? description;
  final String? address;
  final String? phone;
  final String? businessType;
  final String? logoUrl;
  final String? coverUrl;
  final String? mapsUrl;
  final int slotDuration;
  final int cancellationHours;
  final List<Service> services;
  final List<BusinessHours> hours;
  final List<Map<String, dynamic>> customFields;
  final bool allowClientResourceSelection;
  final List<BusinessResource> businessResources;

  const Business({
    required this.id,
    required this.slug,
    required this.name,
    this.description,
    this.address,
    this.phone,
    this.businessType,
    this.logoUrl,
    this.coverUrl,
    this.mapsUrl,
    this.slotDuration = 30,
    this.cancellationHours = 1,
    this.services = const [],
    this.hours = const [],
    this.customFields = const [],
    this.allowClientResourceSelection = false,
    this.businessResources = const [],
  });

  @override
  List<Object?> get props => [id, slug];
}
