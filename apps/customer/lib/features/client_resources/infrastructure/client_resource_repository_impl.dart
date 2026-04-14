import 'package:dio/dio.dart';
import 'package:fpdart/fpdart.dart';
import '../../../core/error/failures.dart';
import '../../../core/network/dio_client.dart';
import '../domain/entities/client_resource.dart';
import '../domain/entities/wash_history_entry.dart';
import '../domain/repositories/i_client_resource_repository.dart';

class ClientResourceRepositoryImpl implements IClientResourceRepository {
  final Dio _dio = DioClient.instance;

  @override
  Future<Either<Failure, List<ClientResource>>> getAll() async {
    try {
      final response = await _dio.get('/client-resources');
      final data = response.data['data'] as List<dynamic>;
      final resources = data
          .map((e) => _clientResourceFromJson(e as Map<String, dynamic>))
          .toList();
      return Right(resources);
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) {
        return const Left(AuthFailure());
      }
      return Left(
        ServerFailure(
          e.response?.data?['error']?['message'] ?? 'Error al obtener recursos',
        ),
      );
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
      final resource = _clientResourceFromJson(
        response.data['data'] as Map<String, dynamic>,
      );
      return Right(resource);
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) {
        return const Left(AuthFailure());
      }
      return Left(
        ServerFailure(
          e.response?.data?['error']?['message'] ?? 'Error al crear recurso',
        ),
      );
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, List<WashHistoryEntry>>> getHistory(
      String clientResourceId) async {
    try {
      final response = await _dio.get('/client-resources/$clientResourceId/history');
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
        return const Left(NotFoundFailure('Recurso no encontrado'));
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

  ClientResource _clientResourceFromJson(Map<String, dynamic> json) {
    return ClientResource(
      id: json['id'] as String,
      label: json['label'] as String? ?? json['id'] as String,
      data: json['data'] as Map<String, dynamic>?,
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
