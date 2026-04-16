import '../../../domain/entities/service_log.dart';
import '../../../domain/repositories/service_log_repository.dart';
import '../../../shared/types/paginated_result.dart';
import '../dio_client.dart';
import '../mappers/service_log_mapper.dart';
import 'paginated_helper.dart';

class ApiServiceLogRepository implements ServiceLogRepository {
  final DioClient _client;

  ApiServiceLogRepository(this._client);

  @override
  Future<PaginatedResult<ServiceLog>> getAll({String? date, int? page}) async {
    final params = <String, dynamic>{};
    if (date != null) params['date'] = date;
    if (page != null) params['page'] = page;

    final response =
        await _client.dio.get('/service-logs', queryParameters: params);
    return extractPaginated(response.data, mapServiceLog);
  }

  @override
  Future<ServiceLog> getById(int id) async {
    final response = await _client.dio.get('/service-logs/$id');
    final data = response.data['data'] ?? response.data;
    return mapServiceLog(data as Map<String, dynamic>);
  }

  @override
  Future<ServiceLog> create({
    required int clientResourceId,
    required int serviceId,
    required int attendedBy,
    required double priceCharged,
    required PaymentMethod paymentMethod,
    String? notes,
  }) async {
    final body = <String, dynamic>{
      'client_resource_id': clientResourceId,
      'service_id': serviceId,
      'attended_by': attendedBy,
      'price_charged': priceCharged,
      'payment_method': paymentMethod.apiValue,
    };
    if (notes != null) body['notes'] = notes;

    final response = await _client.dio.post('/service-logs', data: body);
    final data = response.data['data'] ?? response.data;
    return mapServiceLog(data as Map<String, dynamic>);
  }

  @override
  Future<ServiceLog> update(
    int id, {
    int? serviceId,
    int? attendedBy,
    double? priceCharged,
    PaymentMethod? paymentMethod,
    String? notes,
  }) async {
    final body = <String, dynamic>{};
    if (serviceId != null) body['service_id'] = serviceId;
    if (attendedBy != null) body['attended_by'] = attendedBy;
    if (priceCharged != null) body['price_charged'] = priceCharged;
    if (paymentMethod != null) body['payment_method'] = paymentMethod.apiValue;
    if (notes != null) body['notes'] = notes;

    final response = await _client.dio.patch('/service-logs/$id', data: body);
    final data = response.data['data'] ?? response.data;
    return mapServiceLog(data as Map<String, dynamic>);
  }

  @override
  Future<void> delete(int id) async {
    await _client.dio.delete('/service-logs/$id');
  }

  @override
  Future<ServiceLog> complete(int id) async {
    final response = await _client.dio.patch('/service-logs/$id/complete');
    final data = response.data['data'] ?? response.data;
    return mapServiceLog(data as Map<String, dynamic>);
  }

  @override
  Future<DailySummary> getSummary(String date) async {
    final response = await _client.dio
        .get('/service-logs/summary', queryParameters: {'date': date});
    final data = response.data['data'] ?? response.data;
    return mapDailySummary(data as Map<String, dynamic>);
  }
}
