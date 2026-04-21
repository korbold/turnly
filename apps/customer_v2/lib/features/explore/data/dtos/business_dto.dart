// lib/features/explore/data/dtos/business_dto.dart
import '../../domain/entities/business.dart';
import '../../domain/entities/service.dart';
import '../../domain/entities/business_hours.dart';

class BusinessDto {
  final Map<String, dynamic> json;

  BusinessDto(this.json);

  Business toEntity() {
    final servicesJson = json['services'] as List<dynamic>? ?? [];
    final availabilityJson = json['availability'] as List<dynamic>? ?? [];
    final tenantSlotDuration = (json['slot_duration'] as int?) ??
        (json['tenant'] as Map<String, dynamic>?)?['slot_duration'] as int? ??
        30;

    return Business(
      id: json['id'] as String? ?? json['slug'] as String? ?? '',
      slug: json['slug'] as String? ?? '',
      name: json['name'] as String? ?? '',
      description: json['description'] as String?,
      address: json['address'] as String?,
      phone: json['phone'] as String?,
      businessType: json['business_type'] as String?,
      logoUrl: json['logo_url'] as String?,
      coverUrl: json['cover_url'] as String?,
      mapsUrl: (json['social_links'] as Map<String, dynamic>?)?['maps_url'] as String?,
      slotDuration: json['slot_duration'] as int? ?? 30,
      cancellationHours: json['cancellation_hours'] as int? ?? 1,
      services: servicesJson
          .map((s) => _serviceFromJson(s as Map<String, dynamic>, tenantSlotDuration))
          .toList(),
      hours: _parseAvailability(availabilityJson),
      customFields: (json['custom_fields'] as List<dynamic>?)
              ?.map((e) => e as Map<String, dynamic>)
              .toList() ??
          [],
    );
  }

  static Service _serviceFromJson(Map<String, dynamic> json, int tenantSlotDuration) {
    // price can be String ("5.00") or num
    final rawPrice = json['price'];
    final price = rawPrice is num
        ? rawPrice.toDouble()
        : double.tryParse(rawPrice?.toString() ?? '0') ?? 0.0;

    return Service(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      description: json['description'] as String?,
      price: price,
      durationMinutes: json['duration_minutes'] as int? ?? tenantSlotDuration,
    );
  }

  static const _dayNames = [
    'Domingo', 'Lunes', 'Martes', 'Miercoles',
    'Jueves', 'Viernes', 'Sabado',
  ];

  /// API returns flat list: [{day_of_week, start_time, end_time}, ...]
  /// Group by day_of_week into BusinessHours with TimeRanges
  static List<BusinessHours> _parseAvailability(List<dynamic> raw) {
    final Map<int, List<TimeRange>> grouped = {};

    for (final item in raw) {
      final m = item as Map<String, dynamic>;
      final day = m['day_of_week'] as int;
      final start = (m['start_time'] as String?)?.substring(0, 5) ??
          (m['start'] as String? ?? '00:00');
      final end = (m['end_time'] as String?)?.substring(0, 5) ??
          (m['end'] as String? ?? '00:00');

      grouped.putIfAbsent(day, () => []);
      grouped[day]!.add(TimeRange(start: start, end: end));
    }

    // Create entries for all 7 days
    return List.generate(7, (day) {
      final ranges = grouped[day] ?? [];
      return BusinessHours(
        dayOfWeek: day,
        dayName: _dayNames[day],
        isOpen: ranges.isNotEmpty,
        ranges: ranges,
      );
    });
  }
}
