class User {
  final String id;
  final String name;
  final String email;
  final String? phone;
  final bool isSuperAdmin;

  const User({
    required this.id,
    required this.name,
    required this.email,
    this.phone,
    this.isSuperAdmin = false,
  });
}
