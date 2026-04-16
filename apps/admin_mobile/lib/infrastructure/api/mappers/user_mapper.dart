import '../../../domain/entities/user.dart';

User mapUser(Map<String, dynamic> json) {
  return User(
    id: json['id'] as int,
    name: json['name'] as String,
    email: json['email'] as String,
    phone: json['phone'] as String?,
    isSuperAdmin: json['is_super_admin'] as bool? ?? false,
    createdAt: DateTime.parse(json['created_at'] as String),
    role: json['role'] != null ? UserRole.fromApi(json['role'] as String) : null,
  );
}
