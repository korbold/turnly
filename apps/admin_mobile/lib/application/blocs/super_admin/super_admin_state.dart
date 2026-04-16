part of 'super_admin_bloc.dart';

abstract class SuperAdminState extends Equatable {
  const SuperAdminState();

  @override
  List<Object?> get props => [];
}

class SuperAdminInitial extends SuperAdminState {
  const SuperAdminInitial();
}

class SuperAdminLoading extends SuperAdminState {
  const SuperAdminLoading();
}

class SuperAdminStatsLoaded extends SuperAdminState {
  final Map<String, dynamic> stats;

  const SuperAdminStatsLoaded(this.stats);

  @override
  List<Object?> get props => [stats];
}

class SuperAdminTenantsLoaded extends SuperAdminState {
  final PaginatedResult<Tenant> tenants;

  const SuperAdminTenantsLoaded(this.tenants);

  @override
  List<Object?> get props => [tenants];
}

class SuperAdminUsersLoaded extends SuperAdminState {
  final PaginatedResult<User> users;

  const SuperAdminUsersLoaded(this.users);

  @override
  List<Object?> get props => [users];
}

class SuperAdminError extends SuperAdminState {
  final String message;

  const SuperAdminError(this.message);

  @override
  List<Object?> get props => [message];
}
