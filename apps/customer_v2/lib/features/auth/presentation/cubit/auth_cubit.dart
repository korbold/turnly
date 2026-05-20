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
  // Overrideable for testing; production code resolves from GetIt.
  final Future<void> Function()? _initPush;

  AuthCubit(this._repository, {Future<void> Function()? initPush})
      : _initPush = initPush,
        super(const AuthInitial());

  Future<void> _callInitPush() =>
      _initPush != null ? _initPush() : getIt<PushNotificationService>().init();

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
          _callInitPush();
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
    print('[AuthCubit] register start email=$email');
    final result = await _repository.register(
      name: name,
      email: email,
      password: password,
      phone: phone,
    );
    result.fold(
      (failure) {
        print('[AuthCubit] register FAIL: ${failure.message}');
        emit(AuthError(failure.message));
      },
      (data) {
        print('[AuthCubit] register OK email=${data.user.email} verified=${data.user.emailVerified} -> emitting AuthEmailUnverified');
        emit(AuthEmailUnverified(data.user.email));
      },
    );
  }

  /// Email magic link: send the link to the user's inbox. UI should
  /// transition to a "check your email" state on success.
  Future<void> sendMagicLink(String email) async {
    emit(const AuthLoading());
    final result = await _repository.sendMagicLink(email);
    result.fold(
      (failure) => emit(AuthError(failure.message)),
      (_) => emit(AuthMagicLinkSent(email)),
    );
  }

  /// Complete sign-in with the link the user tapped from email.
  /// [email] must match the one that requested the link (Firebase
  /// requirement for security).
  Future<void> signInWithEmailLink({
    required String email,
    required String link,
  }) async {
    emit(const AuthLoading());
    final result = await _repository.signInWithEmailLink(
      email: email,
      link: link,
    );
    await result.fold(
      (failure) async => emit(AuthError(failure.message)),
      (data) async {
        if (data.user.termsAcceptedAt == null) {
          emit(const AuthTermsPending());
        } else {
          await SecureStorage.setTermsAccepted(true);
          emit(AuthAuthenticated(data.user));
          await _callInitPush();
        }
      },
    );
  }

  Future<void> loginWithGoogle() async {
    emit(const AuthLoading());
    final result = await _repository.loginWithGoogle();
    await result.fold(
      (failure) async {
        if (failure.message == 'Inicio de sesión cancelado') {
          emit(const AuthInitial());
        } else {
          emit(AuthError(failure.message));
        }
      },
      (data) async {
        if (data.user.termsAcceptedAt == null) {
          emit(const AuthTermsPending());
        } else {
          await SecureStorage.setTermsAccepted(true);
          emit(AuthAuthenticated(data.user));
          await _callInitPush();
        }
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
        } else if (user.termsAcceptedAt == null) {
          emit(const AuthTermsPending());
        } else {
          await SecureStorage.setTermsAccepted(true);
          emit(AuthAuthenticated(user));
          await _callInitPush();
        }
      } else {
        await getMe();
      }
    } else {
      emit(const AuthUnauthenticated());
    }
  }
}
