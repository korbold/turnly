import 'package:dio/dio.dart';
import 'package:fpdart/fpdart.dart';
import '../../../core/error/failures.dart';
import '../../../core/network/dio_client.dart';
import '../domain/entities/vehicle.dart';
import '../domain/entities/wash_history_entry.dart';
import '../domain/repositories/i_vehicle_repository.dart';

class VehicleRepositoryImpl implements IVehicleRepository {
  final Dio _dio = DioClient.instance;

  @override
  Future<Either<Failure, List<Vehicle>>> getAll() async {
    try {
      final response = await _dio.get('/vehicles');
      final data = response.data['data'] as List<dynamic>;
      final vehicles = data
          .map((e) => _vehicleFromJson(e as Map<String, dynamic>))
          .toList();
      return Right(vehicles);
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) {
        return const Left(AuthFailure());
      }
      return Left(
        ServerFailure(
          e.response?.data?['error']?['message'] ?? 'Error al obtener vehículos',
        ),
      );
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, Vehicle>> create({
    required String plate,
    String? brand,
    String? model,
    String? color,
    String type = 'sedan',
  }) async {
    try {
      final response = await _dio.post('/vehicles', data: {
        'plate': plate,
        'type': type,
        if (brand != null) 'brand': brand,
        if (model != null) 'model': model,
        if (color != null) 'color': color,
      });
      final vehicle = _vehicleFromJson(
        response.data['data'] as Map<String, dynamic>,
      );
      return Right(vehicle);
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) {
        return const Left(AuthFailure());
      }
      return Left(
        ServerFailure(
          e.response?.data?['error']?['message'] ?? 'Error al crear vehículo',
        ),
      );
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, List<WashHistoryEntry>>> getHistory(
      String vehicleId) async {
    try {
      final response = await _dio.get('/vehicles/$vehicleId/history');
      final data = response.data['data'] as List<dynamic>;
      final entries = data
          .map((e) => _historyEntryFromJson(e as Map<String, dynamic>))
          .toList();
      return Right(entries);
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) {
        return const Left(AuthFailure());
      }
      if (e.response?.statusCode == 404) {
        return const Left(NotFoundFailure('Vehículo no encontrado'));
      }
      return Left(
        ServerFailure(
          e.response?.data?['error']?['message'] ??
              'Error al obtener historial',
        ),
      );
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  Vehicle _vehicleFromJson(Map<String, dynamic> json) {
    return Vehicle(
      id: json['id'] as String,
      plate: json['plate'] as String,
      brand: json['brand'] as String?,
      model: json['model'] as String?,
      color: json['color'] as String?,
      type: json['type'] as String? ?? 'sedan',
      ownerName: json['owner_name'] as String?,
    );
  }

  WashHistoryEntry _historyEntryFromJson(Map<String, dynamic> json) {
    return WashHistoryEntry(
      id: json['id'] as String,
      serviceName: json['service_name'] as String,
      startedAt: DateTime.parse(json['started_at'] as String),
      finishedAt: json['finished_at'] != null
          ? DateTime.parse(json['finished_at'] as String)
          : null,
      priceCharged: (json['price_charged'] as num).toDouble(),
      paymentMethod: json['payment_method'] as String,
      status: json['status'] as String,
    );
  }
}
