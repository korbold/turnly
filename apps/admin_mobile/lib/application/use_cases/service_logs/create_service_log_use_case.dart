import '../../../domain/entities/service_log.dart';
import '../../../domain/repositories/service_log_repository.dart';

class CreateServiceLogUseCase {
  final ServiceLogRepository _repo;
  CreateServiceLogUseCase(this._repo);

  Future<ServiceLog> call({
    required int clientResourceId,
    required int serviceId,
    required int attendedBy,
    required double priceCharged,
    required PaymentMethod paymentMethod,
    String? notes,
  }) =>
      _repo.create(
        clientResourceId: clientResourceId,
        serviceId: serviceId,
        attendedBy: attendedBy,
        priceCharged: priceCharged,
        paymentMethod: paymentMethod,
        notes: notes,
      );
}
