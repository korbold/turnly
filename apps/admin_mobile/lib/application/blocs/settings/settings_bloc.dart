import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../use_cases/settings/get_settings_use_case.dart';
import '../../use_cases/settings/update_settings_use_case.dart';

part 'settings_event.dart';
part 'settings_state.dart';

class SettingsBloc extends Bloc<SettingsEvent, SettingsState> {
  final GetSettingsUseCase _getSettings;
  final UpdateSettingsUseCase _updateSettings;

  SettingsBloc({
    required GetSettingsUseCase getSettings,
    required UpdateSettingsUseCase updateSettings,
  })  : _getSettings = getSettings,
        _updateSettings = updateSettings,
        super(const SettingsInitial()) {
    on<LoadSettings>(_onLoad);
    on<UpdateSettings>(_onUpdate);
  }

  Future<void> _onLoad(
      LoadSettings event, Emitter<SettingsState> emit) async {
    emit(const SettingsLoading());
    try {
      final data = await _getSettings();
      emit(SettingsLoaded(data));
    } catch (e) {
      emit(SettingsError(e.toString()));
    }
  }

  Future<void> _onUpdate(
      UpdateSettings event, Emitter<SettingsState> emit) async {
    emit(const SettingsLoading());
    try {
      final data = await _updateSettings(event.data);
      emit(SettingsLoaded(data));
    } catch (e) {
      emit(SettingsError(e.toString()));
    }
  }
}
