import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:customer_v2/core/connectivity/connectivity_cubit.dart';
import 'package:customer_v2/core/connectivity/connectivity_state.dart';
import 'package:customer_v2/core/connectivity/connectivity_service.dart';

class _MockConnectivityService implements ConnectivityServiceBase {
  final StreamController<bool> _controller = StreamController<bool>.broadcast();
  bool _online;

  _MockConnectivityService({bool initialOnline = true}) : _online = initialOnline;

  @override
  Stream<bool> get onConnectivityChanged => _controller.stream;

  @override
  Future<bool> get isOnline async => _online;

  void emitOnline() {
    _online = true;
    _controller.add(true);
  }

  void emitOffline() {
    _online = false;
    _controller.add(false);
  }

  void dispose() => _controller.close();
}

void main() {
  group('ConnectivityCubit', () {
    late _MockConnectivityService service;
    late ConnectivityCubit cubit;

    setUp(() {
      service = _MockConnectivityService();
      cubit = ConnectivityCubit(service, restoredDuration: const Duration(milliseconds: 10));
    });

    tearDown(() {
      cubit.close();
      service.dispose();
    });

    test('initial state is ConnectivityOnline when connected', () async {
      await Future.delayed(const Duration(milliseconds: 50));
      expect(cubit.state, isA<ConnectivityOnline>());
    });

    test('emits ConnectivityOffline when connection drops', () async {
      await Future.delayed(const Duration(milliseconds: 50));
      service.emitOffline();
      await Future.delayed(const Duration(milliseconds: 50));
      expect(cubit.state, isA<ConnectivityOffline>());
    });

    test('emits ConnectivityRestored then ConnectivityOnline when reconnected', () async {
      await Future.delayed(const Duration(milliseconds: 20));
      service.emitOffline();
      await Future.delayed(const Duration(milliseconds: 20));
      service.emitOnline();
      // yield to the event loop so the stream callback fires and emits ConnectivityRestored,
      // but before the 10ms timer fires
      await Future.microtask(() {});
      await Future.delayed(const Duration(milliseconds: 5));
      expect(cubit.state, isA<ConnectivityRestored>());
      await Future.delayed(const Duration(milliseconds: 50)); // 10ms duration + buffer
      expect(cubit.state, isA<ConnectivityOnline>());
    });

    test('initial state is ConnectivityOffline when no connection on startup', () async {
      service.dispose();
      service = _MockConnectivityService(initialOnline: false);
      cubit.close();
      cubit = ConnectivityCubit(service);
      await Future.delayed(const Duration(milliseconds: 50));
      expect(cubit.state, isA<ConnectivityOffline>());
    });
  });
}
