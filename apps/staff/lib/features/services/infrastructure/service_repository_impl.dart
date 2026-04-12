import 'package:dio/dio.dart';
import 'package:fpdart/fpdart.dart';
import '../../../core/error/failures.dart';
import '../../../core/network/dio_client.dart';
import '../domain/entities/service.dart';
import '../domain/repositories/i_service_repository.dart';

class ServiceRepositoryImpl implements IServiceRepository {
  final Dio _dio = DioClient.instance;

  Service _fromJson(Map<String, dynamic> json) {
    return Service(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      price: (json['price'] as num).toDouble(),
      durationMinutes: json['duration_minutes'] as int,
      isActive: json['is_active'] as bool? ?? true,
      sortOrder: json['sort_order'] as int? ?? 0,
    );
  }

  @override
  Future<Either<Failure, List<Service>>> getAll() async {
    try {
      final response = await _dio.get('/services');
      final data = response.data['data'] as List<dynamic>;
      return Right(data.map((e) => _fromJson(e as Map<String, dynamic>)).toList());
    } on DioException catch (e) {
      return Left(ServerFailure(
        e.response?.data?['error']?['message']?.toString() ?? 'Error al cargar servicios',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, Service>> create({
    required String name,
    required double price,
    required int durationMinutes,
    String? description,
  }) async {
    try {
      final body = <String, dynamic>{
        'name': name,
        'price': price,
        'duration_minutes': durationMinutes,
        if (description != null && description.isNotEmpty) 'description': description,
      };
      final response = await _dio.post('/services', data: body);
      return Right(_fromJson(response.data['data'] as Map<String, dynamic>));
    } on DioException catch (e) {
      return Left(ServerFailure(
        e.response?.data?['error']?['message']?.toString() ?? 'Error al crear servicio',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, Service>> update(
    String id, {
    String? name,
    double? price,
    int? durationMinutes,
    String? description,
    bool? isActive,
  }) async {
    try {
      final body = <String, dynamic>{
        if (name != null) 'name': name,
        if (price != null) 'price': price,
        if (durationMinutes != null) 'duration_minutes': durationMinutes,
        if (description != null) 'description': description,
        if (isActive != null) 'is_active': isActive,
      };
      final response = await _dio.put('/services/$id', data: body);
      return Right(_fromJson(response.data['data'] as Map<String, dynamic>));
    } on DioException catch (e) {
      return Left(ServerFailure(
        e.response?.data?['error']?['message']?.toString() ?? 'Error al actualizar servicio',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, Unit>> delete(String id) async {
    try {
      await _dio.delete('/services/$id');
      return const Right(unit);
    } on DioException catch (e) {
      return Left(ServerFailure(
        e.response?.data?['error']?['message']?.toString() ?? 'Error al eliminar servicio',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }
}
