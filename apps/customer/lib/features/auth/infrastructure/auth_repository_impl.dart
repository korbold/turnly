import 'dart:developer' as dev;
import 'package:dio/dio.dart';
import 'package:fpdart/fpdart.dart';
import '../../../core/error/failures.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/storage/secure_storage.dart';
import '../domain/entities/user.dart';
import '../domain/repositories/i_auth_repository.dart';
import 'dtos/auth_dto.dart';

class AuthRepositoryImpl implements IAuthRepository {
  final Dio _dio = DioClient.instance;

  @override
  Future<Either<Failure, ({User user, String token})>> login(String email, String password) async {
    try {
      final response = await _dio.post('/auth/login', data: {
        'email': email,
        'password': password,
      });
      final dto = AuthResponseDto.fromJson(response.data['data'] as Map<String, dynamic>);
      await SecureStorage.saveToken(dto.token);
      return Right((user: dto.user.toEntity(), token: dto.token));
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) {
        return const Left(AuthFailure('Email o contraseña incorrectos'));
      }
      return Left(ServerFailure(e.response?.data?['error']?['message'] ?? 'Error del servidor'));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, ({User user, String token})>> register({
    required String name,
    required String email,
    required String password,
    String? phone,
  }) async {
    try {
      final response = await _dio.post('/auth/register', data: {
        'name': name,
        'email': email,
        'password': password,
        'password_confirmation': password,
        if (phone != null) 'phone': phone,
      });
      final dto = AuthResponseDto.fromJson(response.data['data'] as Map<String, dynamic>);
      await SecureStorage.saveToken(dto.token);
      return Right((user: dto.user.toEntity(), token: dto.token));
    } on DioException catch (e) {
      dev.log('Register DioException: status=${e.response?.statusCode}', name: 'AUTH');
      dev.log('Register response data: ${e.response?.data}', name: 'AUTH');
      final data = e.response?.data;
      String msg = 'Error al registrarse';
      if (data is Map) {
        if (data['message'] != null) {
          msg = data['message'].toString();
        } else if (data['error']?['message'] != null) {
          msg = data['error']['message'].toString();
        }
        // Extract first validation error
        if (data['errors'] is Map) {
          final errors = data['errors'] as Map;
          if (errors.isNotEmpty) {
            final first = errors.values.first;
            if (first is List && first.isNotEmpty) {
              msg = first.first.toString();
            }
          }
        }
      }
      dev.log('Register error msg: $msg', name: 'AUTH');
      return Left(ServerFailure(msg));
    } catch (e) {
      dev.log('Register unexpected error: $e', name: 'AUTH');
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, Unit>> logout() async {
    try {
      await _dio.post('/auth/logout');
      await SecureStorage.clear();
      return const Right(unit);
    } catch (_) {
      await SecureStorage.clear();
      return const Right(unit);
    }
  }

  @override
  Future<bool> isAuthenticated() async {
    final token = await SecureStorage.getToken();
    return token != null;
  }
}
