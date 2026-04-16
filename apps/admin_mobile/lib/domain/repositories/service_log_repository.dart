import '../entities/service_log.dart';
import '../../shared/types/paginated_result.dart';

abstract class ServiceLogRepository {
  Future<PaginatedResult<ServiceLog>> getAll({String? date, int? page});
  Future<ServiceLog> getById(int id);
  Future<ServiceLog> create({
    required int clientResourceId,
    required int serviceId,
    required int attendedBy,
    required double priceCharged,
    required PaymentMethod paymentMethod,
    String? notes,
  });
  Future<ServiceLog> update(
    int id, {
    int? serviceId,
    int? attendedBy,
    double? priceCharged,
    PaymentMethod? paymentMethod,
    String? notes,
  });
  Future<void> delete(int id);
  Future<ServiceLog> complete(int id);
  Future<DailySummary> getSummary(String date);
}
