// lib/core/error/exceptions.dart
class ServerException implements Exception {
  final String message;
  final int? statusCode;

  const ServerException({required this.message, this.statusCode});
}

class AuthException implements Exception {
  final String message;
  const AuthException([this.message = 'Authentication failed']);
}

class NetworkException implements Exception {
  final String message;
  const NetworkException([this.message = 'No internet connection']);
}

class CacheException implements Exception {
  final String message;
  const CacheException([this.message = 'Cache error']);
}
