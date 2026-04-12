class LoginResponseDto {
  final String userId;
  final String userName;
  final String userEmail;
  final String token;

  LoginResponseDto({
    required this.userId,
    required this.userName,
    required this.userEmail,
    required this.token,
  });

  factory LoginResponseDto.fromJson(Map<String, dynamic> json) {
    final data = json['data'] as Map<String, dynamic>;
    final user = data['user'] as Map<String, dynamic>;
    return LoginResponseDto(
      userId: user['id'] as String,
      userName: user['name'] as String,
      userEmail: user['email'] as String,
      token: data['token'] as String,
    );
  }
}

class UserWithRoleDto {
  final String id;
  final String name;
  final String email;
  final String? role;

  UserWithRoleDto({
    required this.id,
    required this.name,
    required this.email,
    this.role,
  });

  factory UserWithRoleDto.fromJson(Map<String, dynamic> json) {
    return UserWithRoleDto(
      id: json['id'] as String,
      name: json['name'] as String,
      email: json['email'] as String,
      role: json['role'] as String?,
    );
  }
}
