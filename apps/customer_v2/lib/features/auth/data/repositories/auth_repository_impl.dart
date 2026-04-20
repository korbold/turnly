// lib/features/auth/data/repositories/auth_repository_impl.dart
import 'package:dio/dio.dart';
import 'package:fpdart/fpdart.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/storage/secure_storage.dart';
import '../../domain/entities/user.dart';
import '../../domain/repositories/auth_repository.dart';
import '../dtos/auth_dto.dart';

class AuthRepositoryImpl implements AuthRepository {
  final Dio _dio = ApiClient.instance;

  @override
  Future<Either<Failure, ({User user, String token})>> login(
    String email,
    String password,
  ) async {
    try {
      final response = await _dio.post('/auth/login', data: {
        'email': email,
        'password': password,
      });
      final dto = AuthResponseDto.fromJson(
        response.data['data'] as Map<String, dynamic>,
      );
      await SecureStorage.saveToken(dto.token);
      return Right((user: dto.user.toEntity(), token: dto.token));
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) {
        return const Left(AuthFailure('Email o contrasena incorrectos'));
      }
      return Left(_extractError(e, 'Error al iniciar sesion'));
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
      final dto = AuthResponseDto.fromJson(
        response.data['data'] as Map<String, dynamic>,
      );
      await SecureStorage.saveToken(dto.token);
      return Right((user: dto.user.toEntity(), token: dto.token));
    } on DioException catch (e) {
      return Left(_extractError(e, 'Error al registrarse'));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, User>> getMe() async {
    try {
      final response = await _dio.get('/auth/me');
      final data = response.data['data'] as Map<String, dynamic>;
      final userJson = data['user'] as Map<String, dynamic>? ?? data;
      return Right(UserDto.fromJson(userJson).toEntity());
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) {
        return const Left(AuthFailure());
      }
      return Left(_extractError(e, 'Error al obtener perfil'));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, Unit>> logout() async {
    try {
      await _dio.post('/auth/logout');
    } catch (_) {
      // Logout even if API call fails
    }
    await SecureStorage.clear();
    ApiClient.reset();
    return const Right(unit);
  }

  @override
  Future<bool> isAuthenticated() async {
    final token = await SecureStorage.getToken();
    return token != null;
  }

  @override
  Future<Either<Failure, ({User user, String token})>> loginWithGoogle() async {
    try {
      final googleSignIn = GoogleSignIn(scopes: ['email', 'profile']);
      final account = await googleSignIn.signIn();

      if (account == null) {
        return const Left(ServerFailure('Inicio de sesión cancelado'));
      }

      final auth = await account.authentication;
      final idToken = auth.idToken;

      if (idToken == null) {
        return const Left(ServerFailure('Error al obtener token de Google'));
      }

      final response = await _dio.post(
        '/auth/google',
        data: {'id_token': idToken},
      );

      final dto = AuthResponseDto.fromJson(
        response.data['data'] as Map<String, dynamic>,
      );
      await SecureStorage.saveToken(dto.token);

      return Right((user: dto.user.toEntity(), token: dto.token));
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) {
        final msg = e.response?.data['error']?['message'] ?? 'Token de Google inválido';
        return Left(ServerFailure(msg.toString()));
      }
      return Left(_extractError(e, 'Error al iniciar con Google'));
    } catch (e) {
      return Left(ServerFailure('Error al iniciar con Google'));
    }
  }

  ServerFailure _extractError(DioException e, String fallback) {
    final data = e.response?.data;
    if (data is Map) {
      // Check validation errors first
      if (data['errors'] is Map) {
        final errors = data['errors'] as Map;
        if (errors.isNotEmpty) {
          final first = errors.values.first;
          if (first is List && first.isNotEmpty) {
            return ServerFailure(first.first.toString());
          }
        }
      }
      final msg = data['error']?['message'] ?? data['message'];
      if (msg != null) return ServerFailure(msg.toString());
    }
    return ServerFailure(fallback);
  }
}
