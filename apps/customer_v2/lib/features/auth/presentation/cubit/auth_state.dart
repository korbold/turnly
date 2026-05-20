// lib/features/auth/presentation/cubit/auth_state.dart
import 'package:equatable/equatable.dart';
import '../../domain/entities/user.dart';

sealed class AuthState extends Equatable {
  const AuthState();

  @override
  List<Object?> get props => [];
}

class AuthInitial extends AuthState {
  const AuthInitial();
}

class AuthLoading extends AuthState {
  const AuthLoading();
}

class AuthAuthenticated extends AuthState {
  final User user;
  const AuthAuthenticated(this.user);

  @override
  List<Object?> get props => [user];
}

class AuthUnauthenticated extends AuthState {
  const AuthUnauthenticated();
}

class AuthError extends AuthState {
  final String message;
  const AuthError(this.message);

  @override
  List<Object?> get props => [message];
}

/// Emitted when login/register succeeds but the email isn't verified yet.
class AuthEmailUnverified extends AuthState {
  final String email;
  const AuthEmailUnverified(this.email);

  @override
  List<Object?> get props => [email];
}

/// Emitted after sendMagicLink succeeds. UI should show a "check your
/// email" screen until the user taps the link and the deep link handler
/// brings them back into the app.
class AuthMagicLinkSent extends AuthState {
  final String email;
  const AuthMagicLinkSent(this.email);

  @override
  List<Object?> get props => [email];
}

/// Emitted when the user has authenticated but has not yet accepted the
/// Terms & Conditions. UI should navigate to the T&C acceptance screen.
class AuthTermsPending extends AuthState {
  const AuthTermsPending();
}
