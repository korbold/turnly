import '../../../domain/entities/service_log.dart';
import '../../../domain/repositories/service_log_repository.dart';

class UpdateServiceLogUseCase {
  final ServiceLogRepository _repo;
  UpdateServiceLogUseCase(this._repo);

  Future<ServiceLog> call(
    int id, {
    int? serviceId,
    int? attendedBy,
    double? priceCharged,
    PaymentMethod? paymentMethod,
    String? notes,
  }) =>
      _repo.update(
        id,
        serviceId: serviceId,
        attendedBy: attendedBy,
        priceCharged: priceCharged,
        paymentMethod: paymentMethod,
        notes: notes,
      );
}
