import 'package:dio/dio.dart';
import 'package:fpdart/fpdart.dart';
import '../../../core/error/failures.dart';
import '../../../core/network/dio_client.dart';
import '../domain/entities/reservation.dart';
import '../domain/repositories/i_reservation_repository.dart';
import 'dtos/reservation_dto.dart';

class ReservationRepositoryImpl implements IReservationRepository {
  final Dio _dio = DioClient.instance;

  @override
  Future<Either<Failure, List<Reservation>>> getAll({String? date, String? status}) async {
    try {
      final params = <String, dynamic>{};
      if (date != null) params['date'] = date;
      if (status != null) params['status'] = status;

      final response = await _dio.get('/reservations', queryParameters: params.isNotEmpty ? params : null);
      final data = response.data['data'] as List<dynamic>;
      return Right(data
          .map((e) => ReservationDto.fromJson(e as Map<String, dynamic>).toEntity())
          .toList());
    } on DioException catch (e) {
      return Left(ServerFailure(
        e.response?.data?['error']?['message']?.toString() ?? 'Error al cargar reservaciones',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, Reservation>> getById(String id) async {
    try {
      final response = await _dio.get('/reservations/$id');
      return Right(ReservationDto.fromJson(response.data['data'] as Map<String, dynamic>).toEntity());
    } on DioException catch (e) {
      return Left(ServerFailure(
        e.response?.data?['error']?['message']?.toString() ?? 'Error al cargar reservación',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, Unit>> confirm(String id) async {
    try {
      await _dio.patch('/reservations/$id/confirm');
      return const Right(unit);
    } on DioException catch (e) {
      return Left(ServerFailure(
        e.response?.data?['error']?['message']?.toString() ?? 'Error al confirmar reservación',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, Unit>> start(String id) async {
    try {
      await _dio.patch('/reservations/$id/start');
      return const Right(unit);
    } on DioException catch (e) {
      return Left(ServerFailure(
        e.response?.data?['error']?['message']?.toString() ?? 'Error al iniciar reservación',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, Unit>> complete(String id) async {
    try {
      await _dio.patch('/reservations/$id/complete');
      return const Right(unit);
    } on DioException catch (e) {
      return Left(ServerFailure(
        e.response?.data?['error']?['message']?.toString() ?? 'Error al completar reservación',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, Unit>> cancel(String id, {String? reason}) async {
    try {
      await _dio.patch(
        '/reservations/$id/cancel',
        data: reason != null && reason.isNotEmpty ? {'reason': reason} : null,
      );
      return const Right(unit);
    } on DioException catch (e) {
      return Left(ServerFailure(
        e.response?.data?['error']?['message']?.toString() ?? 'Error al cancelar reservación',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }
}
