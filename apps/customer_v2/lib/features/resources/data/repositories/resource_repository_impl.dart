// lib/features/resources/data/repositories/resource_repository_impl.dart
import 'package:dio/dio.dart';
import 'package:fpdart/fpdart.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/network/api_client.dart';
import '../../domain/entities/client_resource.dart';
import '../../domain/entities/service_history_entry.dart';
import '../../domain/repositories/resource_repository.dart';

class ResourceRepositoryImpl implements ResourceRepository {
  final Dio _dio = ApiClient.instance;

  @override
  Future<Either<Failure, List<ClientResource>>> getAll() async {
    try {
      final response = await _dio.get('/client-resources');
      final data = response.data['data'] as List<dynamic>;
      final resources = data.map((e) {
        final json = e as Map<String, dynamic>;
        return ClientResource(
          id: json['id'] as String,
          label: json['label'] as String? ?? json['id'] as String,
          data: json['data'] as Map<String, dynamic>?,
        );
      }).toList();
      return Right(resources);
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) return const Left(AuthFailure());
      return Left(ServerFailure(
        e.response?.data?['error']?['message'] ?? 'Error al obtener registros',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, ClientResource>> create({
    required String label,
    Map<String, dynamic>? data,
  }) async {
    try {
      final response = await _dio.post('/client-resources', data: {
        'label': label,
        if (data != null) 'data': data,
      });
      final json = response.data['data'] as Map<String, dynamic>;
      return Right(ClientResource(
        id: json['id'] as String,
        label: json['label'] as String? ?? label,
        data: json['data'] as Map<String, dynamic>?,
      ));
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) return const Left(AuthFailure());
      return Left(ServerFailure(
        e.response?.data?['error']?['message'] ?? 'Error al crear registro',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, List<ServiceHistoryEntry>>> getHistory(
    String resourceId,
  ) async {
    try {
      final response = await _dio.get('/client-resources/$resourceId/history');
      final data = response.data['data'] as List<dynamic>;
      final entries = data.map((e) {
        final json = e as Map<String, dynamic>;
        return ServiceHistoryEntry(
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
      }).toList();
      return Right(entries);
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) return const Left(AuthFailure());
      if (e.response?.statusCode == 404) {
        return const Left(NotFoundFailure('Registro no encontrado'));
      }
      return Left(ServerFailure(
        e.response?.data?['error']?['message'] ?? 'Error al obtener historial',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }
}
