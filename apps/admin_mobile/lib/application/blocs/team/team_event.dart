part of 'team_bloc.dart';

abstract class TeamEvent extends Equatable {
  const TeamEvent();

  @override
  List<Object?> get props => [];
}

class LoadTeam extends TeamEvent {
  const LoadTeam();
}

class InviteUser extends TeamEvent {
  final String email;
  final UserRole role;

  const InviteUser({required this.email, required this.role});

  @override
  List<Object?> get props => [email, role];
}

class ChangeRole extends TeamEvent {
  final int userId;
  final UserRole role;

  const ChangeRole({required this.userId, required this.role});

  @override
  List<Object?> get props => [userId, role];
}
