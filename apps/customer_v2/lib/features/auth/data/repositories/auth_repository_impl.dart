// lib/features/auth/data/repositories/auth_repository_impl.dart
import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:fpdart/fpdart.dart';
import 'package:firebase_auth/firebase_auth.dart' hide User;
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
      await SecureStorage.saveUserData(jsonEncode(dto.user.toJson()));
      return Right((user: dto.user.toEntity(), token: dto.token));
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) {
        return const Left(AuthFailure('Email o contrasena incorrectos'));
      }
      if (e.response?.statusCode == 403 &&
          e.response?.data is Map &&
          (e.response?.data['error']?['code'] == 'EMAIL_NOT_VERIFIED')) {
        final body = e.response!.data['error'] as Map;
        return Left(EmailUnverifiedFailure(
          (body['email'] ?? email).toString(),
          body['message']?.toString(),
        ));
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
      print('[AuthRepo] register status=${response.statusCode} body=${response.data}');
      final dto = AuthResponseDto.fromJson(
        response.data['data'] as Map<String, dynamic>,
      );
      await SecureStorage.saveToken(dto.token);
      await SecureStorage.saveUserData(jsonEncode(dto.user.toJson()));
      print('[AuthRepo] register parsed user.email=${dto.user.email} verified=${dto.user.emailVerified}');
      return Right((user: dto.user.toEntity(), token: dto.token));
    } on DioException catch (e) {
      print('[AuthRepo] register DIO err status=${e.response?.statusCode} body=${e.response?.data}');
      return Left(_extractError(e, 'Error al registrarse'));
    } catch (e) {
      print('[AuthRepo] register catch: $e');
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, User>> getMe() async {
    try {
      final response = await _dio.get('/auth/me');
      final data = response.data['data'] as Map<String, dynamic>;
      final userJson = data['user'] as Map<String, dynamic>? ?? data;
      await SecureStorage.saveUserData(jsonEncode(userJson));
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
    } catch (_) {}
    try {
      await GoogleSignIn().signOut();
    } catch (_) {}
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
      // 1. Get a Google credential via google_sign_in.
      final googleSignIn = GoogleSignIn(scopes: ['email', 'profile']);
      final account = await googleSignIn.signIn();
      if (account == null) {
        return const Left(ServerFailure('Inicio de sesión cancelado'));
      }
      final auth = await account.authentication;
      if (auth.idToken == null) {
        return const Left(ServerFailure('Error al obtener token de Google'));
      }

      // 2. Exchange the Google credential for a Firebase ID token. The
      //    backend validates Firebase ID tokens via the Firebase Admin SDK
      //    — that's what makes per-env Firebase projects (dev/prod) isolate
      //    cleanly without an audience headache.
      final credential = GoogleAuthProvider.credential(
        accessToken: auth.accessToken,
        idToken: auth.idToken,
      );
      final userCredential =
          await FirebaseAuth.instance.signInWithCredential(credential);
      final firebaseIdToken = await userCredential.user?.getIdToken();
      if (firebaseIdToken == null) {
        return const Left(ServerFailure('Error al obtener token de Firebase'));
      }

      final response = await _dio.post(
        '/auth/google',
        data: {'id_token': firebaseIdToken},
      );

      final dto = AuthResponseDto.fromJson(
        response.data['data'] as Map<String, dynamic>,
      );
      await SecureStorage.saveToken(dto.token);
      await SecureStorage.saveUserData(jsonEncode(dto.user.toJson()));

      return Right((user: dto.user.toEntity(), token: dto.token));
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) {
        final msg = e.response?.data['error']?['message'] ?? 'Token de Google inválido';
        return Left(ServerFailure(msg.toString()));
      }
      return Left(_extractError(e, 'Error al iniciar con Google'));
    } catch (e, st) {
      // Log original error so the cause shows in `flutter run` output.
      // ignore: avoid_print
      print('[GoogleSignIn] error: $e\n$st');
      return Left(ServerFailure('Error al iniciar con Google: $e'));
    }
  }

  @override
  Future<Either<Failure, Unit>> verifyEmail({
    required String email,
    required String code,
  }) async {
    try {
      await _dio.post('/auth/verify-email', data: {
        'email': email,
        'code': code,
      });
      return const Right(unit);
    } on DioException catch (e) {
      return Left(_extractError(e, 'Código inválido'));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, Unit>> resendVerification({required String email}) async {
    try {
      await _dio.post('/auth/verify-email/resend', data: {'email': email});
      return const Right(unit);
    } on DioException catch (e) {
      return Left(_extractError(e, 'No se pudo reenviar el código'));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, Unit>> sendMagicLink(String email) async {
    try {
      // Pick the right host so the deep link routes back to the correct
      // env. Backend sets API_BASE_URL per env (.env.dev vs .env.prod);
      // we strip the API path to recover the public domain.
      final apiUrl = ApiClient.baseUrl;
      final host = Uri.parse(apiUrl).host.replaceFirst(RegExp(r'^api\.'), '');
      final continueUrl = 'https://$host/auth/email-link?email=${Uri.encodeComponent(email)}';

      final actionCodeSettings = ActionCodeSettings(
        url: continueUrl,
        handleCodeInApp: true,
        iOSBundleId: 'com.turnly.customer.dev',
        androidPackageName: 'com.turnly.customer.dev',
        androidInstallApp: true,
        androidMinimumVersion: '21',
      );

      await FirebaseAuth.instance.sendSignInLinkToEmail(
        email: email,
        actionCodeSettings: actionCodeSettings,
      );
      return const Right(unit);
    } on FirebaseAuthException catch (e) {
      return Left(ServerFailure(e.message ?? 'No se pudo enviar el link'));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, ({User user, String token})>> signInWithEmailLink({
    required String email,
    required String link,
  }) async {
    try {
      if (!FirebaseAuth.instance.isSignInWithEmailLink(link)) {
        return const Left(ServerFailure('Link inválido'));
      }
      final userCredential = await FirebaseAuth.instance.signInWithEmailLink(
        email: email,
        emailLink: link,
      );
      final firebaseIdToken = await userCredential.user?.getIdToken();
      if (firebaseIdToken == null) {
        return const Left(ServerFailure('Error al obtener token de Firebase'));
      }

      final response = await _dio.post(
        '/auth/google',
        data: {'id_token': firebaseIdToken},
      );
      final dto = AuthResponseDto.fromJson(
        response.data['data'] as Map<String, dynamic>,
      );
      await SecureStorage.saveToken(dto.token);
      await SecureStorage.saveUserData(jsonEncode(dto.user.toJson()));
      return Right((user: dto.user.toEntity(), token: dto.token));
    } on FirebaseAuthException catch (e) {
      return Left(ServerFailure(e.message ?? 'Link expirado o inválido'));
    } on DioException catch (e) {
      return Left(_extractError(e, 'Error al iniciar con email'));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
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
