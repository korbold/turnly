// lib/features/resources/data/repositories/resource_repository_impl.dart
import 'dart:developer' as dev;
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
      dev.log('[ResourceRepo] GET /client-resources');
      final response = await _dio.get('/client-resources');
      dev.log('[ResourceRepo] GET response status=${response.statusCode} data=${response.data}');
      final data = response.data['data'] as List<dynamic>;
      dev.log('[ResourceRepo] Parsed ${data.length} resources');
      final resources = data.map((e) {
        final json = e as Map<String, dynamic>;
        return ClientResource(
          id: json['id'] as String,
          label: _buildLabel(json),
          data: json['data'] as Map<String, dynamic>?,
        );
      }).toList();
      return Right(resources);
    } on DioException catch (e) {
      dev.log('[ResourceRepo] GET DioException: status=${e.response?.statusCode} body=${e.response?.data}');
      if (e.response?.statusCode == 401) return const Left(AuthFailure());
      return Left(ServerFailure(
        e.response?.data?['error']?['message'] ?? 'Error al obtener registros',
      ));
    } catch (e) {
      dev.log('[ResourceRepo] GET Exception: $e');
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, ClientResource>> create({
    required String label,
    Map<String, dynamic>? data,
  }) async {
    try {
      final payload = {
        'label': label,
        if (data != null) 'data': data,
      };
      dev.log('[ResourceRepo] POST /client-resources payload=$payload');
      dev.log('[ResourceRepo] Headers: ${_dio.options.headers}');
      final response = await _dio.post('/client-resources', data: payload);
      dev.log('[ResourceRepo] Response status=${response.statusCode} data=${response.data}');
      final json = response.data as Map<String, dynamic>;
      return Right(ClientResource(
        id: json['id'] as String,
        label: _buildLabel(json),
        data: json['data'] as Map<String, dynamic>?,
      ));
    } on DioException catch (e) {
      dev.log('[ResourceRepo] DioException: status=${e.response?.statusCode} body=${e.response?.data}');
      if (e.response?.statusCode == 401) return const Left(AuthFailure());
      return Left(ServerFailure(
        e.response?.data?['error']?['message'] ?? 'Error al crear registro',
      ));
    } catch (e) {
      dev.log('[ResourceRepo] Exception: $e');
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, Unit>> update({required String id, Map<String, dynamic>? data}) async {
    try {
      dev.log('[ResourceRepo] PATCH /client-resources/$id data=$data');
      await _dio.patch('/client-resources/$id', data: {'data': data});
      return const Right(unit);
    } on DioException catch (e) {
      dev.log('[ResourceRepo] PATCH DioException: ${e.response?.statusCode} ${e.response?.data}');
      return Left(ServerFailure(
        e.response?.data?['message'] ?? 'Error al actualizar registro',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, Unit>> delete(String id) async {
    try {
      dev.log('[ResourceRepo] DELETE /client-resources/$id');
      await _dio.delete('/client-resources/$id');
      return const Right(unit);
    } on DioException catch (e) {
      dev.log('[ResourceRepo] DELETE DioException: ${e.response?.statusCode}');
      return Left(ServerFailure(
        e.response?.data?['error']?['message'] ?? 'Error al eliminar registro',
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

  /// Build a human-readable label from resource fields.
  /// Tries plate+brand+model first, then label, then id.
  String _buildLabel(Map<String, dynamic> json) {
    // Use label from backend (built from data + custom fields)
    final label = json['label'] as String?;
    if (label != null && label.isNotEmpty) return label;

    // Fallback: plate/brand/model columns
    final plate = json['plate'] as String?;
    final brand = json['brand'] as String?;
    final model = json['model'] as String?;
    final parts = [plate, brand, model].where((s) => s != null && s.isNotEmpty);
    if (parts.isNotEmpty) return parts.join(' - ');

    return json['id'] as String? ?? 'Sin nombre';
  }
}
