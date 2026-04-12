import 'package:fpdart/fpdart.dart';
import '../../../../core/error/failures.dart';
import '../entities/client_resource.dart';
import '../entities/wash_history_entry.dart';

abstract class IClientResourceRepository {
  Future<Either<Failure, List<ClientResource>>> getAll();
  Future<Either<Failure, ClientResource>> create({
    required String label,
    Map<String, dynamic>? data,
  });
  Future<Either<Failure, List<WashHistoryEntry>>> getHistory(String clientResourceId);
}
