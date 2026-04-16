import '../../../domain/entities/reservation.dart';
import '../../../domain/repositories/reservation_repository.dart';
import '../../../shared/types/paginated_result.dart';
import '../dio_client.dart';
import '../mappers/reservation_mapper.dart';
import 'paginated_helper.dart';

class ApiReservationRepository implements ReservationRepository {
  final DioClient _client;

  ApiReservationRepository(this._client);

  @override
  Future<PaginatedResult<Reservation>> getAll(
      ReservationFilters filters) async {
    final params = <String, dynamic>{};
    if (filters.dateFrom != null) {
      params['date_from'] = filters.dateFrom!.toIso8601String().split('T')[0];
    }
    if (filters.dateTo != null) {
      params['date_to'] = filters.dateTo!.toIso8601String().split('T')[0];
    }
    if (filters.status != null) {
      params['status'] = filters.status!.apiValue;
    }
    if (filters.serviceId != null) {
      params['service_id'] = filters.serviceId;
    }
    if (filters.page != null) {
      params['page'] = filters.page;
    }

    final response =
        await _client.dio.get('/reservations', queryParameters: params);
    return extractPaginated(response.data, mapReservation);
  }

  @override
  Future<Reservation> getById(int id) async {
    final response = await _client.dio.get('/reservations/$id');
    final data = response.data['data'] ?? response.data;
    return mapReservation(data as Map<String, dynamic>);
  }

  @override
  Future<Reservation> create({
    required int clientResourceId,
    required int serviceId,
    required String scheduledAt,
    int? assignedTo,
    String? notes,
  }) async {
    final body = <String, dynamic>{
      'client_resource_id': clientResourceId,
      'service_id': serviceId,
      'scheduled_at': scheduledAt,
    };
    if (assignedTo != null) body['assigned_to'] = assignedTo;
    if (notes != null) body['notes'] = notes;

    final response = await _client.dio.post('/reservations', data: body);
    final data = response.data['data'] ?? response.data;
    return mapReservation(data as Map<String, dynamic>);
  }

  @override
  Future<Reservation> cancel(int id, String reason) async {
    final response = await _client.dio.patch('/reservations/$id/cancel', data: {
      'reason': reason,
    });
    final data = response.data['data'] ?? response.data;
    return mapReservation(data as Map<String, dynamic>);
  }

  @override
  Future<Reservation> transition(int id, ReservationAction action) async {
    final response =
        await _client.dio.patch('/reservations/$id/${action.apiValue}');
    final data = response.data['data'] ?? response.data;
    return mapReservation(data as Map<String, dynamic>);
  }

  @override
  Future<List<AvailableSlot>> getAvailableSlots(
      String date, int serviceId) async {
    final response = await _client.dio
        .get('/reservations/available-slots', queryParameters: {
      'date': date,
      'service_id': serviceId,
    });
    final data = response.data['data'] as List? ?? response.data as List;
    return data
        .map((e) => mapAvailableSlot(e as Map<String, dynamic>))
        .toList();
  }
}
