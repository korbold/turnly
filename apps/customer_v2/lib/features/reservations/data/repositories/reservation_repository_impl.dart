// lib/features/reservations/data/repositories/reservation_repository_impl.dart
import 'package:dio/dio.dart';
import 'package:fpdart/fpdart.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/network/api_client.dart';
import '../../domain/entities/reservation.dart';
import '../../domain/entities/available_slot.dart';
import '../../domain/repositories/reservation_repository.dart';
import '../dtos/reservation_dto.dart';

class ReservationRepositoryImpl implements ReservationRepository {
  final Dio _dio = ApiClient.instance;

  @override
  Future<Either<Failure, List<Reservation>>> getAll({String? status}) async {
    try {
      final queryParams = <String, dynamic>{};
      if (status != null) queryParams['status'] = status;

      final response = await _dio.get(
        '/client/reservations',
        queryParameters: queryParams.isNotEmpty ? queryParams : null,
      );

      final data = response.data['data'] as List<dynamic>;
      final reservations = data
          .map((e) => ReservationDto(e as Map<String, dynamic>).toEntity())
          .toList();
      return Right(reservations);
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) return const Left(AuthFailure());
      return Left(ServerFailure(
        e.response?.data?['error']?['message'] ?? 'Error al obtener reservas',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, Reservation>> getById(String id) async {
    try {
      final response = await _dio.get('/client/reservations/$id');
      return Right(
        ReservationDto(response.data['data'] as Map<String, dynamic>).toEntity(),
      );
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) {
        return const Left(NotFoundFailure('Reserva no encontrada'));
      }
      if (e.response?.statusCode == 401) return const Left(AuthFailure());
      return Left(ServerFailure(
        e.response?.data?['error']?['message'] ?? 'Error al obtener reserva',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, Reservation>> create({
    required String clientResourceId,
    required String serviceId,
    required String scheduledAt,
    String? notes,
  }) async {
    try {
      final response = await _dio.post('/reservations', data: {
        'client_resource_id': clientResourceId,
        'service_id': serviceId,
        'scheduled_at': scheduledAt,
        if (notes != null) 'notes': notes,
      });
      return Right(
        ReservationDto(response.data['data'] as Map<String, dynamic>).toEntity(),
      );
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) return const Left(AuthFailure());
      return Left(ServerFailure(
        e.response?.data?['error']?['message'] ?? 'Error al crear reserva',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, List<AvailableSlot>>> getAvailableSlots(
    String date,
    String serviceId,
  ) async {
    try {
      final response = await _dio.get(
        '/reservations/available-slots',
        queryParameters: {'date': date, 'service_id': serviceId},
      );

      final data = response.data['data'] as List<dynamic>;
      final slots = data.map((e) {
        final map = e as Map<String, dynamic>;
        return AvailableSlot(
          start: DateTime.parse(map['start'] as String),
          end: DateTime.parse(map['end'] as String),
          available: map['available'] as int,
        );
      }).toList();
      return Right(slots);
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) return const Left(AuthFailure());
      return Left(ServerFailure(
        e.response?.data?['error']?['message'] ?? 'Error al obtener horarios',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, Unit>> cancel(String id, {String? reason}) async {
    try {
      await _dio.patch('/client/reservations/$id/cancel', data: {
        if (reason != null) 'reason': reason,
      });
      return const Right(unit);
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) return const Left(AuthFailure());
      return Left(ServerFailure(
        e.response?.data?['error']?['message'] ?? 'Error al cancelar reserva',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }
}
