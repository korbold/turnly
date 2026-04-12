import 'package:fpdart/fpdart.dart';
import '../../../../core/error/failures.dart';
import '../entities/vehicle.dart';
import '../entities/wash_history_entry.dart';

abstract class IVehicleRepository {
  Future<Either<Failure, List<Vehicle>>> getAll();
  Future<Either<Failure, Vehicle>> create({
    required String plate,
    String? brand,
    String? model,
    String? color,
    String type,
  });
  Future<Either<Failure, List<WashHistoryEntry>>> getHistory(String vehicleId);
}
