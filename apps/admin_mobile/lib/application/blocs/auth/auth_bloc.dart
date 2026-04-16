import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../domain/entities/user.dart';
import '../../../domain/entities/tenant.dart';
import '../../../infrastructure/storage/secure_storage.dart';
import '../../use_cases/auth/login_use_case.dart';
import '../../use_cases/auth/logout_use_case.dart';
import '../../use_cases/auth/get_me_use_case.dart';
import '../../use_cases/auth/register_use_case.dart';

part 'auth_event.dart';
part 'auth_state.dart';

class AuthBloc extends Bloc<AuthEvent, AuthState> {
  final LoginUseCase _loginUseCase;
  final LogoutUseCase _logoutUseCase;
  final GetMeUseCase _getMeUseCase;
  final RegisterUseCase _registerUseCase;
  final SecureStorageService _storage;

  AuthBloc({
    required LoginUseCase loginUseCase,
    required LogoutUseCase logoutUseCase,
    required GetMeUseCase getMeUseCase,
    required RegisterUseCase registerUseCase,
    required SecureStorageService storage,
  })  : _loginUseCase = loginUseCase,
        _logoutUseCase = logoutUseCase,
        _getMeUseCase = getMeUseCase,
        _registerUseCase = registerUseCase,
        _storage = storage,
        super(const AuthInitial()) {
    on<LoginRequested>(_onLogin);
    on<RegisterRequested>(_onRegister);
    on<LogoutRequested>(_onLogout);
    on<CheckAuthRequested>(_onCheckAuth);
  }

  Future<void> _onLogin(LoginRequested event, Emitter<AuthState> emit) async {
    emit(const AuthLoading());
    try {
      final result = await _loginUseCase(event.email, event.password);
      await _storage.setToken(result.token);
      emit(AuthAuthenticated(user: result.user, tenant: result.tenant));
    } catch (e) {
      emit(AuthError(e.toString()));
    }
  }

  Future<void> _onRegister(
      RegisterRequested event, Emitter<AuthState> emit) async {
    emit(const AuthLoading());
    try {
      final result = await _registerUseCase(
        name: event.name,
        email: event.email,
        password: event.password,
      );
      await _storage.setToken(result.token);
      emit(AuthAuthenticated(user: result.user, tenant: result.tenant));
    } catch (e) {
      emit(AuthError(e.toString()));
    }
  }

  Future<void> _onLogout(
      LogoutRequested event, Emitter<AuthState> emit) async {
    try {
      await _logoutUseCase();
    } catch (_) {
      // Logout even if API call fails
    }
    await _storage.deleteToken();
    emit(const AuthUnauthenticated());
  }

  Future<void> _onCheckAuth(
      CheckAuthRequested event, Emitter<AuthState> emit) async {
    final token = await _storage.getToken();
    if (token == null) {
      emit(const AuthUnauthenticated());
      return;
    }
    try {
      final result = await _getMeUseCase();
      emit(AuthAuthenticated(user: result.user, tenant: result.tenant));
    } catch (_) {
      await _storage.deleteToken();
      emit(const AuthUnauthenticated());
    }
  }
}
