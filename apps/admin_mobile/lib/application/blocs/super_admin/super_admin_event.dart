part of 'super_admin_bloc.dart';

abstract class SuperAdminEvent extends Equatable {
  const SuperAdminEvent();

  @override
  List<Object?> get props => [];
}

class LoadStats extends SuperAdminEvent {
  const LoadStats();
}

class LoadTenants extends SuperAdminEvent {
  final int? page;

  const LoadTenants({this.page});

  @override
  List<Object?> get props => [page];
}

class SuspendTenant extends SuperAdminEvent {
  final int id;

  const SuspendTenant(this.id);

  @override
  List<Object?> get props => [id];
}

class ActivateTenant extends SuperAdminEvent {
  final int id;

  const ActivateTenant(this.id);

  @override
  List<Object?> get props => [id];
}

class LoadUsers extends SuperAdminEvent {
  final int? page;

  const LoadUsers({this.page});

  @override
  List<Object?> get props => [page];
}
