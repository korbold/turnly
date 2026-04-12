import 'package:dio/dio.dart';
import 'package:fpdart/fpdart.dart';
import '../../../core/error/failures.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/storage/secure_storage.dart';
import '../../../shared/enums/user_role.dart';
import '../domain/entities/staff_user.dart';
import '../domain/repositories/i_auth_repository.dart';
import 'dtos/auth_dto.dart';

class AuthRepositoryImpl implements IAuthRepository {
  @override
  Future<Either<Failure, StaffUser>> login(
    String tenantSlug,
    String email,
    String password,
  ) async {
    try {
      // Step 1: Login to get token
      final dio = DioClient.instance;
      final loginResponse = await dio.post('/auth/login', data: {
        'email': email,
        'password': password,
      });

      final loginDto = LoginResponseDto.fromJson(loginResponse.data as Map<String, dynamic>);

      // Step 2: Save token and tenant slug
      await SecureStorage.saveToken(loginDto.token);
      await SecureStorage.saveTenantSlug(tenantSlug);

      // Step 3: Fetch users list to find role (need tenant header now)
      // DioClient's TenantInterceptor will read the slug we just saved
      final usersResponse = await dio.get('/users', queryParameters: {'per_page': 200});
      final usersData = usersResponse.data['data'] as List<dynamic>;

      // Step 4: Find current user by ID
      String? role;
      for (final userData in usersData) {
        final user = userData as Map<String, dynamic>;
        if (user['id'] == loginDto.userId) {
          role = user['role'] as String?;
          break;
        }
      }

      if (role == null) {
        await SecureStorage.clear();
        return const Left(AuthFailure('No perteneces a este negocio'));
      }

      // Step 5: Save user details
      await SecureStorage.saveRole(role);
      await SecureStorage.saveUserId(loginDto.userId);
      await SecureStorage.saveUserName(loginDto.userName);

      return Right(StaffUser(
        id: loginDto.userId,
        name: loginDto.userName,
        email: loginDto.userEmail,
        role: UserRole.fromString(role),
      ));
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) {
        return const Left(AuthFailure('Email o contraseña incorrectos'));
      }
      if (e.response?.statusCode == 404) {
        return const Left(TenantFailure('Negocio no encontrado'));
      }
      if (e.response?.statusCode == 403) {
        return const Left(TenantFailure('Este negocio está suspendido'));
      }
      return Left(ServerFailure(
        e.response?.data?['error']?['message']?.toString() ?? 'Error de conexión',
      ));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, Unit>> logout() async {
    try {
      await DioClient.instance.post('/auth/logout');
    } catch (_) {
      // Ignore logout errors
    }
    await SecureStorage.clear();
    return const Right(unit);
  }

  @override
  Future<bool> isAuthenticated() async {
    final token = await SecureStorage.getToken();
    return token != null;
  }
}
