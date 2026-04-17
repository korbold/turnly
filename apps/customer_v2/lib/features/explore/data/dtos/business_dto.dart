// lib/features/explore/data/dtos/business_dto.dart
import '../../domain/entities/business.dart';
import '../../domain/entities/service.dart';
import '../../domain/entities/business_hours.dart';

class BusinessDto {
  final Map<String, dynamic> json;

  BusinessDto(this.json);

  Business toEntity() {
    final servicesJson = json['services'] as List<dynamic>? ?? [];
    final hoursJson = json['availability'] as List<dynamic>? ?? [];

    return Business(
      id: json['id'] as String,
      slug: json['slug'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      address: json['address'] as String?,
      phone: json['phone'] as String?,
      businessType: json['business_type'] as String?,
      logoUrl: json['logo_url'] as String?,
      coverUrl: json['cover_url'] as String?,
      slotDuration: json['slot_duration'] as int? ?? 30,
      cancellationHours: json['cancellation_hours'] as int? ?? 1,
      services: servicesJson
          .map((s) => _serviceFromJson(s as Map<String, dynamic>))
          .toList(),
      hours: hoursJson
          .map((h) => _hoursFromJson(h as Map<String, dynamic>))
          .toList(),
    );
  }

  static Service _serviceFromJson(Map<String, dynamic> json) {
    return Service(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      price: (json['price'] as num).toDouble(),
      durationMinutes: json['duration_minutes'] as int? ?? 30,
    );
  }

  static BusinessHours _hoursFromJson(Map<String, dynamic> json) {
    final rangesJson = json['ranges'] as List<dynamic>? ?? [];
    return BusinessHours(
      dayOfWeek: json['day_of_week'] as int,
      dayName: json['day_name'] as String? ?? '',
      isOpen: json['is_open'] as bool? ?? false,
      ranges: rangesJson.map((r) {
        final m = r as Map<String, dynamic>;
        return TimeRange(
          start: m['start'] as String,
          end: m['end'] as String,
        );
      }).toList(),
    );
  }
}
