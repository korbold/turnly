import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:customer_v2/core/connectivity/connectivity_cubit.dart';
import 'package:customer_v2/core/connectivity/connectivity_service.dart';
import 'package:customer_v2/core/connectivity/connectivity_state.dart';
import 'package:customer_v2/core/widgets/offline_banner.dart';

class _FakeConnectivityCubit extends ConnectivityCubit {
  _FakeConnectivityCubit(ConnectivityState initial)
      : super(_NullService()) {
    emit(initial);
  }
}

class _NullService implements ConnectivityServiceBase {
  @override
  Stream<bool> get onConnectivityChanged => const Stream.empty();
  @override
  Future<bool> get isOnline async => true;
}

Widget _wrap(Widget child, _FakeConnectivityCubit cubit) {
  return MaterialApp(
    home: BlocProvider<ConnectivityCubit>.value(
      value: cubit,
      child: Scaffold(body: Stack(children: [const Text('content'), child])),
    ),
  );
}

void main() {
  testWidgets('banner hidden when online', (tester) async {
    final cubit = _FakeConnectivityCubit(ConnectivityOnline());
    await tester.pumpWidget(_wrap(const OfflineBanner(), cubit));
    await tester.pump();
    expect(find.text('Sin conexión a internet'), findsNothing);
    cubit.close();
  });

  testWidgets('banner visible when offline', (tester) async {
    final cubit = _FakeConnectivityCubit(ConnectivityOffline());
    await tester.pumpWidget(_wrap(const OfflineBanner(), cubit));
    await tester.pumpAndSettle();
    expect(find.text('Sin conexión a internet'), findsOneWidget);
    cubit.close();
  });

  testWidgets('banner shows restored text on ConnectivityRestored', (tester) async {
    final cubit = _FakeConnectivityCubit(ConnectivityOffline());
    await tester.pumpWidget(_wrap(const OfflineBanner(), cubit));
    await tester.pumpAndSettle();
    cubit.emit(ConnectivityRestored());
    await tester.pumpAndSettle();
    expect(find.text('Conectado'), findsOneWidget);
    cubit.close();
  });

  testWidgets('X button dismisses banner', (tester) async {
    final cubit = _FakeConnectivityCubit(ConnectivityOffline());
    await tester.pumpWidget(_wrap(const OfflineBanner(), cubit));
    await tester.pumpAndSettle();
    await tester.tap(find.byIcon(Icons.close));
    await tester.pumpAndSettle();
    expect(find.text('Sin conexión a internet'), findsNothing);
    cubit.close();
  });
}
