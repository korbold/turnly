// lib/features/auth/presentation/cubit/auth_cubit.dart
import 'dart:convert';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/push/push_notification_service.dart';
import '../../../../core/storage/secure_storage.dart';
import '../../data/dtos/auth_dto.dart';
import '../../domain/repositories/auth_repository.dart';
import 'auth_state.dart';

class AuthCubit extends Cubit<AuthState> {
  final AuthRepository _repository;

  AuthCubit(this._repository) : super(const AuthInitial());

  Future<void> login(String email, String password) async {
    emit(const AuthLoading());
    final result = await _repository.login(email, password);
    result.fold(
      (failure) {
        if (failure is EmailUnverifiedFailure) {
          emit(AuthEmailUnverified(failure.email));
        } else {
          emit(AuthError(failure.message));
        }
      },
      (data) {
        if (!data.user.emailVerified) {
          emit(AuthEmailUnverified(data.user.email));
        } else {
          emit(AuthAuthenticated(data.user));
          getIt<PushNotificationService>().init();
        }
      },
    );
  }

  Future<void> register({
    required String name,
    required String email,
    required String password,
    String? phone,
  }) async {
    emit(const AuthLoading());
    final result = await _repository.register(
      name: name,
      email: email,
      password: password,
      phone: phone,
    );
    result.fold(
      (failure) => emit(AuthError(failure.message)),
      (data) {
        // Backend issues a token, but the email isn't verified yet —
        // stop short of AuthAuthenticated so the verify-email screen
        // takes over before the app shell tries to load tenant data.
        emit(AuthEmailUnverified(data.user.email));
      },
    );
  }

  Future<void> loginWithGoogle() async {
    emit(const AuthLoading());
    final result = await _repository.loginWithGoogle();
    result.fold(
      (failure) {
        if (failure.message == 'Inicio de sesión cancelado') {
          emit(const AuthInitial());
        } else {
          emit(AuthError(failure.message));
        }
      },
      (data) {
        emit(AuthAuthenticated(data.user));
        getIt<PushNotificationService>().init();
      },
    );
  }

  Future<void> getMe() async {
    emit(const AuthLoading());
    final result = await _repository.getMe();
    result.fold(
      (failure) => emit(const AuthUnauthenticated()),
      (user) {
        if (!user.emailVerified) {
          emit(AuthEmailUnverified(user.email));
        } else {
          emit(AuthAuthenticated(user));
        }
      },
    );
  }

  Future<void> logout() async {
    await _repository.logout();
    emit(const AuthUnauthenticated());
  }

  Future<void> checkAuth() async {
    final isAuth = await _repository.isAuthenticated();
    if (isAuth) {
      final userData = await SecureStorage.getUserData();
      if (userData != null) {
        final user = UserDto.fromJson(jsonDecode(userData) as Map<String, dynamic>).toEntity();
        if (!user.emailVerified) {
          emit(AuthEmailUnverified(user.email));
        } else {
          emit(AuthAuthenticated(user));
          getIt<PushNotificationService>().init();
        }
      } else {
        await getMe();
      }
    } else {
      emit(const AuthUnauthenticated());
    }
  }
}
