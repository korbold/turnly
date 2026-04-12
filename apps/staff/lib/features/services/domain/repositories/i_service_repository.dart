import 'package:fpdart/fpdart.dart';
import '../../../../core/error/failures.dart';
import '../entities/service.dart';

abstract class IServiceRepository {
  Future<Either<Failure, List<Service>>> getAll();
  Future<Either<Failure, Service>> create({
    required String name,
    required double price,
    String? description,
  });
  Future<Either<Failure, Service>> update(
    String id, {
    String? name,
    double? price,
    String? description,
    bool? isActive,
  });
  Future<Either<Failure, Unit>> delete(String id);
}
