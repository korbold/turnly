import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../domain/entities/tenant.dart';
import '../../../domain/entities/user.dart';
import '../../../domain/repositories/super_admin_repository.dart';
import '../../../shared/types/paginated_result.dart';

part 'super_admin_event.dart';
part 'super_admin_state.dart';

class SuperAdminBloc extends Bloc<SuperAdminEvent, SuperAdminState> {
  final SuperAdminRepository _repo;

  SuperAdminBloc({required SuperAdminRepository repository})
      : _repo = repository,
        super(const SuperAdminInitial()) {
    on<LoadStats>(_onLoadStats);
    on<LoadTenants>(_onLoadTenants);
    on<SuspendTenant>(_onSuspend);
    on<ActivateTenant>(_onActivate);
    on<LoadUsers>(_onLoadUsers);
  }

  Future<void> _onLoadStats(
      LoadStats event, Emitter<SuperAdminState> emit) async {
    emit(const SuperAdminLoading());
    try {
      final stats = await _repo.getStats();
      emit(SuperAdminStatsLoaded(stats));
    } catch (e) {
      emit(SuperAdminError(e.toString()));
    }
  }

  Future<void> _onLoadTenants(
      LoadTenants event, Emitter<SuperAdminState> emit) async {
    emit(const SuperAdminLoading());
    try {
      final tenants = await _repo.getTenants(page: event.page);
      emit(SuperAdminTenantsLoaded(tenants));
    } catch (e) {
      emit(SuperAdminError(e.toString()));
    }
  }

  Future<void> _onSuspend(
      SuspendTenant event, Emitter<SuperAdminState> emit) async {
    try {
      await _repo.suspendTenant(event.id);
      add(const LoadTenants());
    } catch (e) {
      emit(SuperAdminError(e.toString()));
    }
  }

  Future<void> _onActivate(
      ActivateTenant event, Emitter<SuperAdminState> emit) async {
    try {
      await _repo.activateTenant(event.id);
      add(const LoadTenants());
    } catch (e) {
      emit(SuperAdminError(e.toString()));
    }
  }

  Future<void> _onLoadUsers(
      LoadUsers event, Emitter<SuperAdminState> emit) async {
    emit(const SuperAdminLoading());
    try {
      final users = await _repo.getUsers(page: event.page);
      emit(SuperAdminUsersLoaded(users));
    } catch (e) {
      emit(SuperAdminError(e.toString()));
    }
  }
}
