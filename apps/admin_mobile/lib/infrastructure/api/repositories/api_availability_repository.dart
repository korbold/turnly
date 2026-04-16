import '../../../domain/entities/availability.dart';
import '../../../domain/repositories/availability_repository.dart';
import '../dio_client.dart';

class ApiAvailabilityRepository implements AvailabilityRepository {
  final DioClient _client;

  ApiAvailabilityRepository(this._client);

  @override
  Future<List<AvailabilitySlot>> getSlots() async {
    final response = await _client.dio.get('/availability-slots');
    final data = response.data['data'] ?? response.data;
    return (data as List)
        .map((e) => _mapSlot(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<List<AvailabilitySlot>> updateSlots(
      List<AvailabilitySlot> slots) async {
    final response = await _client.dio.put('/availability-slots', data: {
      'slots': slots
          .map((s) => {
                'id': s.id,
                'day_of_week': s.dayOfWeek,
                'start_time': s.startTime,
                'end_time': s.endTime,
                'max_concurrent': s.maxConcurrent,
                'is_active': s.isActive,
              })
          .toList(),
    });
    final data = response.data['data'] ?? response.data;
    return (data as List)
        .map((e) => _mapSlot(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<List<AvailabilityBlock>> getBlocks() async {
    final response = await _client.dio.get('/availability-blocks');
    final data = response.data['data'] ?? response.data;
    return (data as List)
        .map((e) => _mapBlock(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<AvailabilityBlock> createBlock({
    required String date,
    String? startTime,
    String? endTime,
    String? reason,
  }) async {
    final body = <String, dynamic>{'date': date};
    if (startTime != null) body['start_time'] = startTime;
    if (endTime != null) body['end_time'] = endTime;
    if (reason != null) body['reason'] = reason;

    final response =
        await _client.dio.post('/availability-blocks', data: body);
    final data = response.data['data'] ?? response.data;
    return _mapBlock(data as Map<String, dynamic>);
  }

  @override
  Future<void> deleteBlock(int id) async {
    await _client.dio.delete('/availability-blocks/$id');
  }

  AvailabilitySlot _mapSlot(Map<String, dynamic> json) {
    return AvailabilitySlot(
      id: json['id'] as int,
      dayOfWeek: json['day_of_week'] as int,
      startTime: json['start_time'] as String,
      endTime: json['end_time'] as String,
      maxConcurrent: json['max_concurrent'] as int,
      isActive: json['is_active'] as bool? ?? true,
    );
  }

  AvailabilityBlock _mapBlock(Map<String, dynamic> json) {
    return AvailabilityBlock(
      id: json['id'] as int,
      date: json['date'] as String,
      startTime: json['start_time'] as String?,
      endTime: json['end_time'] as String?,
      reason: json['reason'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }
}
