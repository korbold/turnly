// lib/features/notifications/data/repositories/notification_repository_impl.dart
import 'package:dio/dio.dart';
import 'package:fpdart/fpdart.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/network/api_client.dart';
import '../dtos/notification_dto.dart';
import '../../domain/entities/app_notification.dart';
import '../../domain/repositories/notification_repository.dart';

class NotificationRepositoryImpl implements NotificationRepository {
  final Dio _dio = ApiClient.instance;

  @override
  Future<Either<Failure, List<AppNotification>>> getAll({bool unreadOnly = false}) async {
    try {
      final params = <String, dynamic>{};
      if (unreadOnly) params['unread'] = true;

      final response = await _dio.get('/notifications', queryParameters: params);
      final data = response.data['data'] as List<dynamic>;
      final notifications = data
          .map((e) => NotificationDto(e as Map<String, dynamic>).toEntity())
          .toList();
      return Right(notifications);
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) return const Left(AuthFailure());
      return Left(ServerFailure(
        e.response?.data?['error']?['message'] ?? 'Error al obtener notificaciones',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, int>> getUnreadCount() async {
    try {
      final response = await _dio.get('/notifications', queryParameters: {'unread': true});
      final count = response.data['meta']?['unread_count'] as int? ?? 0;
      return Right(count);
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) return const Left(AuthFailure());
      return Left(ServerFailure(e.toString()));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, Unit>> markAsRead(String id) async {
    try {
      await _dio.post('/notifications/$id/read');
      return const Right(unit);
    } on DioException catch (e) {
      return Left(ServerFailure(
        e.response?.data?['error']?['message'] ?? 'Error al marcar notificación',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, Unit>> markAllAsRead() async {
    try {
      await _dio.post('/notifications/read-all');
      return const Right(unit);
    } on DioException catch (e) {
      return Left(ServerFailure(
        e.response?.data?['error']?['message'] ?? 'Error al marcar notificaciones',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }
}
