// lib/features/auth/domain/entities/user.dart
import 'package:equatable/equatable.dart';

class User extends Equatable {
  final String id;
  final String name;
  final String email;
  final String? phone;
  final bool isSuperAdmin;
  final bool emailVerified;
  final DateTime? termsAcceptedAt;
  final DateTime? deletionRequestedAt;

  const User({
    required this.id,
    required this.name,
    required this.email,
    this.phone,
    this.isSuperAdmin = false,
    this.emailVerified = true,
    this.termsAcceptedAt,
    this.deletionRequestedAt,
  });

  @override
  List<Object?> get props =>
      [id, name, email, phone, isSuperAdmin, emailVerified, termsAcceptedAt, deletionRequestedAt];
}
