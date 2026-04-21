// lib/features/resources/domain/repositories/resource_repository.dart
import 'package:fpdart/fpdart.dart';
import '../../../../core/error/failures.dart';
import '../entities/client_resource.dart';
import '../entities/service_history_entry.dart';

abstract class ResourceRepository {
  Future<Either<Failure, List<ClientResource>>> getAll();
  Future<Either<Failure, ClientResource>> create({
    required String label,
    Map<String, dynamic>? data,
  });
  Future<Either<Failure, Unit>> update({required String id, Map<String, dynamic>? data});
  Future<Either<Failure, Unit>> delete(String id);
  Future<Either<Failure, List<ServiceHistoryEntry>>> getHistory(String resourceId);
}
