import '../../../../shared/enums/user_role.dart';

class TeamMember {
  final String id;
  final String name;
  final String email;
  final String? phone;
  final UserRole role;

  const TeamMember({
    required this.id,
    required this.name,
    required this.email,
    this.phone,
    required this.role,
  });
}
