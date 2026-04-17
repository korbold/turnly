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

  UserDto({
    required this.id,
    required this.name,
    required this.email,
    this.phone,
    this.isSuperAdmin = false,
  });

  factory UserDto.fromJson(Map<String, dynamic> json) {
    return UserDto(
      id: json['id'] as String,
      name: json['name'] as String,
      email: json['email'] as String,
      phone: json['phone'] as String?,
      isSuperAdmin: json['is_super_admin'] as bool? ?? false,
    );
  }

  User toEntity() => User(
    id: id,
    name: name,
    email: email,
    phone: phone,
    isSuperAdmin: isSuperAdmin,
  );
}
