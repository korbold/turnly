// lib/features/auth/data/dtos/auth_dto.dart
import '../../domain/entities/user.dart';

class AuthResponseDto {
  final UserDto user;
  final String token;

  AuthResponseDto({required this.user, required this.token});

  factory AuthResponseDto.fromJson(Map<String, dynamic> json) {
    return AuthResponseDto(
      user: UserDto.fromJson(json['user'] as Map<String, dynamic>),
      token: json['token'] as String,
    );
  }
}

class UserDto {
  final String id;
  final String name;
  final String email;
  final String? phone;
  final bool isSuperAdmin;
  final bool emailVerified;
  final DateTime? termsAcceptedAt;

  UserDto({
    required this.id,
    required this.name,
    required this.email,
    this.phone,
    this.isSuperAdmin = false,
    this.emailVerified = true,
    this.termsAcceptedAt,
  });

  factory UserDto.fromJson(Map<String, dynamic> json) {
    final rawTerms = json['terms_accepted_at'];
    return UserDto(
      id: json['id'] as String,
      name: json['name'] as String,
      email: json['email'] as String,
      phone: json['phone'] as String?,
      isSuperAdmin: json['is_super_admin'] as bool? ?? false,
      emailVerified: json['email_verified'] as bool? ?? true,
      termsAcceptedAt: rawTerms is String ? DateTime.tryParse(rawTerms) : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'email': email,
    'phone': phone,
    'is_super_admin': isSuperAdmin,
    'email_verified': emailVerified,
    'terms_accepted_at': termsAcceptedAt?.toIso8601String(),
  };

  User toEntity() => User(
    id: id,
    name: name,
    email: email,
    phone: phone,
    isSuperAdmin: isSuperAdmin,
    emailVerified: emailVerified,
    termsAcceptedAt: termsAcceptedAt,
  );
}
