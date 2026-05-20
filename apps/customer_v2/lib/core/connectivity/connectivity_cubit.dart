// lib/core/connectivity/connectivity_cubit.dart
import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'connectivity_service.dart';
import 'connectivity_state.dart';

class ConnectivityCubit extends Cubit<ConnectivityState> {
  final ConnectivityServiceBase _service;
  final Duration _restoredDuration;
  StreamSubscription<bool>? _subscription;
  Timer? _restoredTimer;

  ConnectivityCubit(
    this._service, {
    Duration restoredDuration = const Duration(milliseconds: 1500),
  })  : _restoredDuration = restoredDuration,
        super(ConnectivityOnline()) {
    _init();
  }

  Future<void> _init() async {
    final online = await _service.isOnline;
    if (isClosed) return;
    if (!online) emit(ConnectivityOffline());
    _subscription = _service.onConnectivityChanged.listen((isOnline) {
      if (isClosed) return;
      if (isOnline && state is ConnectivityOffline) {
        _restoredTimer?.cancel();
        emit(ConnectivityRestored());
        _restoredTimer = Timer(_restoredDuration, () {
          if (!isClosed) emit(ConnectivityOnline());
        });
      } else if (!isOnline && state is! ConnectivityOffline) {
        _restoredTimer?.cancel();
        emit(ConnectivityOffline());
      }
    });
  }

  @override
  Future<void> close() {
    _subscription?.cancel();
    _restoredTimer?.cancel();
    return super.close();
  }
}
