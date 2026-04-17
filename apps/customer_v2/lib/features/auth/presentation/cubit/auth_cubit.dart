// lib/features/auth/presentation/cubit/auth_cubit.dart
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/repositories/auth_repository.dart';
import 'auth_state.dart';

class AuthCubit extends Cubit<AuthState> {
  final AuthRepository _repository;

  AuthCubit(this._repository) : super(const AuthInitial());

  Future<void> login(String email, String password) async {
    emit(const AuthLoading());
    final result = await _repository.login(email, password);
    result.fold(
      (failure) => emit(AuthError(failure.message)),
      (data) => emit(AuthAuthenticated(data.user)),
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
      (data) => emit(AuthAuthenticated(data.user)),
    );
  }

  Future<void> getMe() async {
    emit(const AuthLoading());
    final result = await _repository.getMe();
    result.fold(
      (failure) => emit(const AuthUnauthenticated()),
      (user) => emit(AuthAuthenticated(user)),
    );
  }

  Future<void> logout() async {
    await _repository.logout();
    emit(const AuthUnauthenticated());
  }

  Future<void> checkAuth() async {
    final isAuth = await _repository.isAuthenticated();
    if (isAuth) {
      await getMe();
    } else {
      emit(const AuthUnauthenticated());
    }
  }
}
