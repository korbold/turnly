import 'package:equatable/equatable.dart';

enum TenantPlan {
  trial,
  basic,
  pro;
}

enum TenantStatus {
  pending,
  active,
  suspended,
  cancelled;
}

enum BusinessType {
  carWash,
  barbershop,
  medical,
  spa,
  gym,
  other;

  String get apiValue {
    switch (this) {
      case BusinessType.carWash:
        return 'car_wash';
      case BusinessType.barbershop:
        return 'barbershop';
      case BusinessType.medical:
        return 'medical';
      case BusinessType.spa:
        return 'spa';
      case BusinessType.gym:
        return 'gym';
      case BusinessType.other:
        return 'other';
    }
  }

  static BusinessType fromApi(String value) {
    switch (value) {
      case 'car_wash':
        return BusinessType.carWash;
      case 'barbershop':
        return BusinessType.barbershop;
      case 'medical':
        return BusinessType.medical;
      case 'spa':
        return BusinessType.spa;
      case 'gym':
        return BusinessType.gym;
      case 'other':
        return BusinessType.other;
      default:
        throw ArgumentError('Unknown BusinessType: $value');
    }
  }
}

class Tenant extends Equatable {
  final int id;
  final String slug;
  final String name;
  final String ownerName;
  final String email;
  final String? phone;
  final String? city;
  final String country;
  final TenantPlan plan;
  final TenantStatus status;
  final DateTime? trialEndsAt;
  final int onboardingStep;
  final DateTime? activatedAt;
  final DateTime createdAt;

  const Tenant({
    required this.id,
    required this.slug,
    required this.name,
    required this.ownerName,
    required this.email,
    this.phone,
    this.city,
    required this.country,
    required this.plan,
    required this.status,
    this.trialEndsAt,
    required this.onboardingStep,
    this.activatedAt,
    required this.createdAt,
  });

  @override
  List<Object?> get props => [id];
}
