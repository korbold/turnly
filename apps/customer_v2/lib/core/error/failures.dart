// lib/core/error/failures.dart
import 'package:equatable/equatable.dart';

sealed class Failure extends Equatable {
  const Failure(this.message);
  final String message;

  @override
  List<Object?> get props => [message];
}

class NetworkFailure extends Failure {
  const NetworkFailure([super.message = 'Sin conexión a internet']);
}

class ServerFailure extends Failure {
  const ServerFailure(super.message, {this.code});
  final String? code;

  @override
  List<Object?> get props => [message, code];
}

class AuthFailure extends Failure {
  const AuthFailure([super.message = 'Sesión expirada']);
}

class NotFoundFailure extends Failure {
  const NotFoundFailure([super.message = 'Recurso no encontrado']);
}

class CacheFailure extends Failure {
  const CacheFailure([super.message = 'Error de almacenamiento local']);
}

class EmailUnverifiedFailure extends Failure {
  const EmailUnverifiedFailure(this.email, [String? message])
      : super(message ?? 'Verifica tu email para continuar');
  final String email;

  @override
  List<Object?> get props => [message, email];
}
