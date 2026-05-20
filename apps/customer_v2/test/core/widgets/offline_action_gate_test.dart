import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:customer_v2/core/connectivity/connectivity_cubit.dart';
import 'package:customer_v2/core/connectivity/connectivity_service.dart';
import 'package:customer_v2/core/connectivity/connectivity_state.dart';
import 'package:customer_v2/core/widgets/offline_action_gate.dart';

class _FakeConnectivityCubit extends ConnectivityCubit {
  _FakeConnectivityCubit(ConnectivityState initial) : super(_NullService()) {
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
      child: Scaffold(body: child),
    ),
  );
}

void main() {
  testWidgets('executes onPressed when online', (tester) async {
    bool pressed = false;
    final cubit = _FakeConnectivityCubit(ConnectivityOnline());
    await tester.pumpWidget(_wrap(
      OfflineActionGate(
        reason: 'para hacer algo',
        child: ElevatedButton(
          onPressed: () => pressed = true,
          child: const Text('Acción'),
        ),
      ),
      cubit,
    ));
    await tester.tap(find.text('Acción'));
    await tester.pump();
    expect(pressed, isTrue);
    cubit.close();
  });

  testWidgets('blocks action and shows modal when offline', (tester) async {
    bool pressed = false;
    final cubit = _FakeConnectivityCubit(ConnectivityOffline());
    await tester.pumpWidget(_wrap(
      OfflineActionGate(
        reason: 'para hacer algo',
        child: ElevatedButton(
          onPressed: () => pressed = true,
          child: const Text('Acción'),
        ),
      ),
      cubit,
    ));
    // Tap at the button's position — the overlay GestureDetector intercepts it.
    await tester.tap(find.text('Acción'), warnIfMissed: false);
    await tester.pumpAndSettle();
    expect(pressed, isFalse);
    expect(find.text('Sin conexión'), findsOneWidget);
    cubit.close();
  });

  testWidgets('modal shows correct reason text', (tester) async {
    final cubit = _FakeConnectivityCubit(ConnectivityOffline());
    await tester.pumpWidget(_wrap(
      OfflineActionGate(
        reason: 'para crear esta reserva',
        child: ElevatedButton(
          onPressed: () {},
          child: const Text('Reservar'),
        ),
      ),
      cubit,
    ));
    // Tap at the button's position — the overlay GestureDetector intercepts it.
    await tester.tap(find.text('Reservar'), warnIfMissed: false);
    await tester.pumpAndSettle();
    expect(find.text('Necesitas internet para crear esta reserva.'), findsOneWidget);
    cubit.close();
  });
}
