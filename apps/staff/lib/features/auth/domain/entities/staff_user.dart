import '../../../../shared/enums/user_role.dart';

class StaffUser {
  final String id;
  final String name;
  final String email;
  final UserRole role;

  const StaffUser({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
  });
}
