import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../domain/entities/user.dart';
import '../../../shared/types/paginated_result.dart';
import '../../use_cases/team/get_team_use_case.dart';
import '../../use_cases/team/invite_user_use_case.dart';
import '../../use_cases/team/change_role_use_case.dart';

part 'team_event.dart';
part 'team_state.dart';

class TeamBloc extends Bloc<TeamEvent, TeamState> {
  final GetTeamUseCase _getTeam;
  final InviteUserUseCase _inviteUser;
  final ChangeRoleUseCase _changeRole;

  TeamBloc({
    required GetTeamUseCase getTeam,
    required InviteUserUseCase inviteUser,
    required ChangeRoleUseCase changeRole,
  })  : _getTeam = getTeam,
        _inviteUser = inviteUser,
        _changeRole = changeRole,
        super(const TeamInitial()) {
    on<LoadTeam>(_onLoad);
    on<InviteUser>(_onInvite);
    on<ChangeRole>(_onChangeRole);
  }

  Future<void> _onLoad(LoadTeam event, Emitter<TeamState> emit) async {
    emit(const TeamLoading());
    try {
      final result = await _getTeam();
      emit(TeamLoaded(result));
    } catch (e) {
      emit(TeamError(e.toString()));
    }
  }

  Future<void> _onInvite(InviteUser event, Emitter<TeamState> emit) async {
    try {
      await _inviteUser(event.email, event.role);
      add(const LoadTeam());
    } catch (e) {
      emit(TeamError(e.toString()));
    }
  }

  Future<void> _onChangeRole(
      ChangeRole event, Emitter<TeamState> emit) async {
    try {
      await _changeRole(event.userId, event.role);
      add(const LoadTeam());
    } catch (e) {
      emit(TeamError(e.toString()));
    }
  }
}
