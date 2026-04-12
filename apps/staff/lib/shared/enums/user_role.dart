import 'package:flutter/material.dart';

enum UserRole {
  tenantAdmin,
  cashier,
  washer;

  static UserRole fromString(String value) {
    switch (value) {
      case 'tenant_admin':
        return UserRole.tenantAdmin;
      case 'cashier':
        return UserRole.cashier;
      case 'washer':
        return UserRole.washer;
      default:
        return UserRole.washer;
    }
  }

  String get apiValue {
    switch (this) {
      case UserRole.tenantAdmin:
        return 'tenant_admin';
      case UserRole.cashier:
        return 'cashier';
      case UserRole.washer:
        return 'washer';
    }
  }

  String get label {
    switch (this) {
      case UserRole.tenantAdmin:
        return 'Administrador';
      case UserRole.cashier:
        return 'Cajero';
      case UserRole.washer:
        return 'Lavador';
    }
  }

  Color get color {
    switch (this) {
      case UserRole.tenantAdmin:
        return const Color(0xFF8B5CF6); // purple
      case UserRole.cashier:
        return const Color(0xFF3B82F6); // blue
      case UserRole.washer:
        return const Color(0xFF10B981); // green
    }
  }

  bool get isAdmin => this == UserRole.tenantAdmin;
}
