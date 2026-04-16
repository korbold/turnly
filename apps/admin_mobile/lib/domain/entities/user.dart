import 'package:equatable/equatable.dart';

enum UserRole {
  tenantAdmin,
  cashier,
  washer,
  client;

  String get apiValue {
    switch (this) {
      case UserRole.tenantAdmin:
        return 'tenant_admin';
      case UserRole.cashier:
        return 'cashier';
      case UserRole.washer:
        return 'washer';
      case UserRole.client:
        return 'client';
    }
  }

  static UserRole fromApi(String value) {
    switch (value) {
      case 'tenant_admin':
        return UserRole.tenantAdmin;
      case 'cashier':
        return UserRole.cashier;
      case 'washer':
        return UserRole.washer;
      case 'client':
        return UserRole.client;
      default:
        throw ArgumentError('Unknown UserRole: $value');
    }
  }
}

class User extends Equatable {
  final int id;
  final String name;
  final String email;
  final String? phone;
  final bool isSuperAdmin;
  final DateTime createdAt;
  final UserRole? role;

  const User({
    required this.id,
    required this.name,
    required this.email,
    this.phone,
    required this.isSuperAdmin,
    required this.createdAt,
    this.role,
  });

  @override
  List<Object?> get props => [id];
}
