// lib/core/error/failures.dart

sealed class Failure {
  const Failure(this.message);
  final String message;
}

class NetworkFailure extends Failure {
  const NetworkFailure([super.message = 'Sin conexión a internet']);
}

class ServerFailure extends Failure {
  const ServerFailure(super.message, {this.code});
  final String? code;
}

class AuthFailure extends Failure {
  const AuthFailure([super.message = 'Sesión expirada']);
}

class TenantFailure extends Failure {
  const TenantFailure(super.message);
}

class NotFoundFailure extends Failure {
  const NotFoundFailure([super.message = 'Recurso no encontrado']);
}
