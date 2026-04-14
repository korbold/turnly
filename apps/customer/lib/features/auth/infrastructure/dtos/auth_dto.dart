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

  UserDto({required this.id, required this.name, required this.email});

  factory UserDto.fromJson(Map<String, dynamic> json) {
    return UserDto(
      id: json['id'] as String,
      name: json['name'] as String,
      email: json['email'] as String,
    );
  }

  User toEntity() => User(id: id, name: name, email: email);
}
