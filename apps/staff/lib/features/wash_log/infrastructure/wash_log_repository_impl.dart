import 'package:dio/dio.dart';
import 'package:fpdart/fpdart.dart';
import '../../../core/error/failures.dart';
import '../../../core/network/dio_client.dart';
import '../domain/entities/wash_log.dart';
import '../domain/entities/daily_summary.dart';
import '../domain/repositories/i_wash_log_repository.dart';
import 'dtos/wash_log_dto.dart';

class WashLogRepositoryImpl implements IWashLogRepository {
  final Dio _dio = DioClient.instance;

  @override
  Future<Either<Failure, List<WashLog>>> getByDate(String date) async {
    try {
      final response = await _dio.get('/wash-logs', queryParameters: {'date': date, 'per_page': 100});
      final data = response.data['data'] as List<dynamic>;
      return Right(data.map((e) => WashLogDto.fromJson(e as Map<String, dynamic>)).toList());
    } on DioException catch (e) {
      return Left(ServerFailure(e.response?.data?['error']?['message']?.toString() ?? 'Error al cargar servicios'));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, WashLog>> create({
    required String vehicleId,
    required String serviceId,
    required String attendedBy,
    required double priceCharged,
    required String paymentMethod,
    String? reservationId,
    String? notes,
  }) async {
    try {
      final response = await _dio.post('/wash-logs', data: {
        'vehicle_id': vehicleId,
        'service_id': serviceId,
        'attended_by': attendedBy,
        'price_charged': priceCharged,
        'payment_method': paymentMethod,
        if (reservationId != null) 'reservation_id': reservationId,
        if (notes != null && notes.isNotEmpty) 'notes': notes,
      });
      return Right(WashLogDto.fromJson(response.data['data'] as Map<String, dynamic>));
    } on DioException catch (e) {
      return Left(ServerFailure(e.response?.data?['error']?['message']?.toString() ?? 'Error al registrar servicio'));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, Unit>> complete(String id) async {
    try {
      await _dio.patch('/wash-logs/$id/complete');
      return const Right(unit);
    } on DioException catch (e) {
      return Left(ServerFailure(e.response?.data?['error']?['message']?.toString() ?? 'Error al completar'));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, DailySummary>> getDailySummary(String date) async {
    try {
      final response = await _dio.get('/wash-logs/summary', queryParameters: {'date': date});
      return Right(DailySummaryDto.fromJson(response.data['data'] as Map<String, dynamic>));
    } on DioException catch (e) {
      return Left(ServerFailure(e.response?.data?['error']?['message']?.toString() ?? 'Error al cargar resumen'));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }
}
