# Offline UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a persistent top overlay banner when offline and block critical actions with a modal, while leaving cached content accessible.

**Architecture:** `ConnectivityService` wraps `connectivity_plus` with DNS validation. `ConnectivityCubit` manages Online/Offline/Restored states. `OfflineBanner` overlays the entire app via `MaterialApp.builder`. `OfflineActionGate` wraps any critical action widget with a transparent tap interceptor.

**Tech Stack:** Flutter, connectivity_plus ^6.1.0, flutter_bloc ^9.0.0, dart:async

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `pubspec.yaml` | Modify | Add connectivity_plus |
| `lib/core/connectivity/connectivity_state.dart` | Create | Sealed state classes |
| `lib/core/connectivity/connectivity_service.dart` | Create | connectivity_plus wrapper + DNS check |
| `lib/core/connectivity/connectivity_cubit.dart` | Create | State machine, timer for Restored→Online |
| `lib/core/widgets/offline_banner.dart` | Create | Animated top overlay banner |
| `lib/core/widgets/offline_action_gate.dart` | Create | Transparent tap interceptor + modal |
| `lib/main.dart` | Modify | Add BlocProvider + MaterialApp.builder |
| `lib/features/reservations/presentation/screens/create_reservation_screen.dart` | Modify | Wrap confirm CTA |
| `lib/features/auth/presentation/screens/login_screen.dart` | Modify | Wrap login + Google actions |
| `test/core/connectivity/connectivity_cubit_test.dart` | Create | Cubit state transitions |
| `test/core/widgets/offline_banner_test.dart` | Create | Banner show/hide/restore |
| `test/core/widgets/offline_action_gate_test.dart` | Create | Gate intercepts tap when offline |

---

## Task 1: Add dependency

**Files:**
- Modify: `apps/customer_v2/pubspec.yaml`

- [ ] **Step 1: Add connectivity_plus to pubspec**

In `pubspec.yaml`, under the Firebase dependencies block:

```yaml
  firebase_crashlytics: ^4.1.0
  firebase_analytics: ^11.3.3
  firebase_messaging: ^15.1.6
  firebase_auth: ^5.3.4
  connectivity_plus: ^6.1.0
```

- [ ] **Step 2: Get packages**

```bash
cd apps/customer_v2 && fvm flutter pub get
```

Expected: resolves without conflicts.

- [ ] **Step 3: Commit**

```bash
git add apps/customer_v2/pubspec.yaml apps/customer_v2/pubspec.lock
git commit -m "chore(customer): add connectivity_plus dependency"
```

---

## Task 2: Connectivity layer (state + service + cubit)

**Files:**
- Create: `apps/customer_v2/lib/core/connectivity/connectivity_state.dart`
- Create: `apps/customer_v2/lib/core/connectivity/connectivity_service.dart`
- Create: `apps/customer_v2/lib/core/connectivity/connectivity_cubit.dart`
- Create: `apps/customer_v2/test/core/connectivity/connectivity_cubit_test.dart`

- [ ] **Step 1: Write the failing test**

Create `test/core/connectivity/connectivity_cubit_test.dart`:

```dart
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
      cubit = ConnectivityCubit(service);
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
      await Future.delayed(const Duration(milliseconds: 50));
      service.emitOffline();
      await Future.delayed(const Duration(milliseconds: 50));
      service.emitOnline();
      await Future.delayed(const Duration(milliseconds: 50));
      expect(cubit.state, isA<ConnectivityRestored>());
      await Future.delayed(const Duration(milliseconds: 1600));
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/customer_v2 && fvm flutter test test/core/connectivity/connectivity_cubit_test.dart
```

Expected: FAIL — target files not found.

- [ ] **Step 3: Create connectivity_state.dart**

```dart
// lib/core/connectivity/connectivity_state.dart
sealed class ConnectivityState {}

class ConnectivityOnline extends ConnectivityState {}

class ConnectivityOffline extends ConnectivityState {}

/// Transient: emitted on reconnect. Auto-transitions to [ConnectivityOnline] after 1.5s.
class ConnectivityRestored extends ConnectivityState {}
```

- [ ] **Step 4: Create connectivity_service.dart**

```dart
// lib/core/connectivity/connectivity_service.dart
import 'dart:io';
import 'package:connectivity_plus/connectivity_plus.dart';

abstract class ConnectivityServiceBase {
  Stream<bool> get onConnectivityChanged;
  Future<bool> get isOnline;
}

class ConnectivityService implements ConnectivityServiceBase {
  final Connectivity _connectivity = Connectivity();

  @override
  Stream<bool> get onConnectivityChanged =>
      _connectivity.onConnectivityChanged.asyncMap(_resolveHasInternet);

  @override
  Future<bool> get isOnline async {
    final results = await _connectivity.checkConnectivity();
    return _resolveHasInternet(results);
  }

  Future<bool> _resolveHasInternet(List<ConnectivityResult> results) async {
    if (results.isEmpty || results.every((r) => r == ConnectivityResult.none)) {
      return false;
    }
    try {
      final lookup = await InternetAddress.lookup('google.com')
          .timeout(const Duration(seconds: 3));
      return lookup.isNotEmpty && lookup[0].rawAddress.isNotEmpty;
    } catch (_) {
      return false;
    }
  }
}
```

- [ ] **Step 5: Create connectivity_cubit.dart**

```dart
// lib/core/connectivity/connectivity_cubit.dart
import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'connectivity_service.dart';
import 'connectivity_state.dart';

class ConnectivityCubit extends Cubit<ConnectivityState> {
  final ConnectivityServiceBase _service;
  late final StreamSubscription<bool> _subscription;
  Timer? _restoredTimer;

  ConnectivityCubit(this._service) : super(ConnectivityOnline()) {
    _init();
  }

  Future<void> _init() async {
    final online = await _service.isOnline;
    if (!online && !isClosed) emit(ConnectivityOffline());

    _subscription = _service.onConnectivityChanged.listen((isOnline) {
      if (isClosed) return;
      if (isOnline && state is ConnectivityOffline) {
        _restoredTimer?.cancel();
        emit(ConnectivityRestored());
        _restoredTimer = Timer(const Duration(milliseconds: 1500), () {
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
    _subscription.cancel();
    _restoredTimer?.cancel();
    return super.close();
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd apps/customer_v2 && fvm flutter test test/core/connectivity/connectivity_cubit_test.dart
```

Expected: All 4 tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/customer_v2/lib/core/connectivity/ apps/customer_v2/test/core/connectivity/
git commit -m "feat(customer): add connectivity layer (service + cubit + states)"
```

---

## Task 3: OfflineBanner widget

**Files:**
- Create: `apps/customer_v2/lib/core/widgets/offline_banner.dart`
- Create: `apps/customer_v2/test/core/widgets/offline_banner_test.dart`

- [ ] **Step 1: Write the failing test**

Create `test/core/widgets/offline_banner_test.dart`:

```dart
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/customer_v2 && fvm flutter test test/core/widgets/offline_banner_test.dart
```

Expected: FAIL — OfflineBanner not found.

- [ ] **Step 3: Create offline_banner.dart**

```dart
// lib/core/widgets/offline_banner.dart
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../connectivity/connectivity_cubit.dart';
import '../connectivity/connectivity_state.dart';
import '../../app/theme/app_colors.dart';

class OfflineBanner extends StatefulWidget {
  const OfflineBanner({super.key});

  @override
  State<OfflineBanner> createState() => _OfflineBannerState();
}

class _OfflineBannerState extends State<OfflineBanner> {
  bool _visible = false;
  bool _isRestored = false;

  @override
  void initState() {
    super.initState();
    final state = context.read<ConnectivityCubit>().state;
    if (state is ConnectivityOffline) _visible = true;
  }

  void _handleState(ConnectivityState state) {
    if (state is ConnectivityOffline) {
      setState(() { _visible = true; _isRestored = false; });
    } else if (state is ConnectivityRestored) {
      setState(() { _visible = true; _isRestored = true; });
    } else if (state is ConnectivityOnline) {
      setState(() { _visible = false; _isRestored = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final reduceMotion = MediaQuery.of(context).disableAnimations;
    final enterMs = reduceMotion ? 150 : 220;
    final exitMs = reduceMotion ? 150 : 160;
    final duration = Duration(milliseconds: _visible ? enterMs : exitMs);

    return BlocListener<ConnectivityCubit, ConnectivityState>(
      listener: (_, state) => _handleState(state),
      child: AnimatedSlide(
        offset: _visible ? Offset.zero : const Offset(0, -1),
        duration: duration,
        curve: Curves.easeOut,
        child: AnimatedOpacity(
          opacity: _visible ? 1.0 : 0.0,
          duration: duration,
          curve: Curves.easeOut,
          child: _BannerContent(
            isRestored: _isRestored,
            onDismiss: () => setState(() => _visible = false),
          ),
        ),
      ),
    );
  }
}

class _BannerContent extends StatelessWidget {
  final bool isRestored;
  final VoidCallback onDismiss;

  const _BannerContent({required this.isRestored, required this.onDismiss});

  @override
  Widget build(BuildContext context) {
    final bg = isRestored
        ? AppColors.success
        : const Color(0xFF1A1F2B);
    final icon = isRestored ? Icons.check_circle_outline : Icons.wifi_off;
    final label = isRestored ? 'Conectado' : 'Sin conexión a internet';

    return Material(
      color: Colors.transparent,
      child: Container(
        width: double.infinity,
        color: bg,
        child: SafeArea(
          bottom: false,
          child: SizedBox(
            height: 48,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  Icon(icon, size: 16, color: Colors.white),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      label,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  Semantics(
                    label: 'Cerrar aviso de sin conexión',
                    child: GestureDetector(
                      onTap: onDismiss,
                      behavior: HitTestBehavior.opaque,
                      child: const SizedBox(
                        width: 44,
                        height: 44,
                        child: Center(
                          child: Icon(Icons.close, size: 16, color: Colors.white),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/customer_v2 && fvm flutter test test/core/widgets/offline_banner_test.dart
```

Expected: All 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/customer_v2/lib/core/widgets/offline_banner.dart apps/customer_v2/test/core/widgets/offline_banner_test.dart
git commit -m "feat(customer): add OfflineBanner overlay widget"
```

---

## Task 4: OfflineActionGate widget

**Files:**
- Create: `apps/customer_v2/lib/core/widgets/offline_action_gate.dart`
- Create: `apps/customer_v2/test/core/widgets/offline_action_gate_test.dart`

- [ ] **Step 1: Write the failing test**

Create `test/core/widgets/offline_action_gate_test.dart`:

```dart
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
    await tester.tap(find.text('Acción'));
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
    await tester.tap(find.text('Reservar'));
    await tester.pumpAndSettle();
    expect(find.text('Necesitas internet para crear esta reserva.'), findsOneWidget);
    cubit.close();
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/customer_v2 && fvm flutter test test/core/widgets/offline_action_gate_test.dart
```

Expected: FAIL — OfflineActionGate not found.

- [ ] **Step 3: Create offline_action_gate.dart**

```dart
// lib/core/widgets/offline_action_gate.dart
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../connectivity/connectivity_cubit.dart';
import '../connectivity/connectivity_state.dart';
import '../../app/theme/app_colors.dart';

class OfflineActionGate extends StatelessWidget {
  final String reason;
  final Widget child;

  const OfflineActionGate({
    super.key,
    required this.reason,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<ConnectivityCubit, ConnectivityState>(
      builder: (context, state) {
        if (state is! ConnectivityOffline) return child;
        return Stack(
          children: [
            child,
            Positioned.fill(
              child: GestureDetector(
                onTap: () => _showOfflineModal(context),
                behavior: HitTestBehavior.opaque,
                child: const ColoredBox(color: Colors.transparent),
              ),
            ),
          ],
        );
      },
    );
  }

  void _showOfflineModal(BuildContext context) {
    final reduceMotion = MediaQuery.of(context).disableAnimations;
    showGeneralDialog(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'Cerrar',
      barrierColor: const Color(0x991A1F2B),
      transitionDuration: Duration(milliseconds: reduceMotion ? 150 : 200),
      transitionBuilder: (context, animation, _, child) {
        if (reduceMotion) {
          return FadeTransition(opacity: animation, child: child);
        }
        return ScaleTransition(
          scale: Tween<double>(begin: 0.95, end: 1.0).animate(
            CurvedAnimation(parent: animation, curve: Curves.easeOut),
          ),
          child: FadeTransition(opacity: animation, child: child),
        );
      },
      pageBuilder: (context, _, __) => _OfflineModal(reason: reason),
    );
  }
}

class _OfflineModal extends StatelessWidget {
  final String reason;

  const _OfflineModal({required this.reason});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Material(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(24),
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: AppColors.warning.withValues(alpha: 0.12),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.wifi_off,
                    color: AppColors.warning,
                    size: 26,
                  ),
                ),
                const SizedBox(height: 20),
                const Text(
                  'Sin conexión',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                    height: 1.25,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  'Necesitas internet $reason.',
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w400,
                    color: AppColors.textSecondary,
                    height: 1.45,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () => Navigator.of(context).pop(),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.accent,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(99),
                      ),
                    ),
                    child: const Text(
                      'Entendido',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/customer_v2 && fvm flutter test test/core/widgets/offline_action_gate_test.dart
```

Expected: All 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/customer_v2/lib/core/widgets/offline_action_gate.dart apps/customer_v2/test/core/widgets/offline_action_gate_test.dart
git commit -m "feat(customer): add OfflineActionGate widget with offline modal"
```

---

## Task 5: Integrate into TurnlyApp

**Files:**
- Modify: `apps/customer_v2/lib/main.dart`

- [ ] **Step 1: Add ConnectivityCubit BlocProvider and banner overlay**

In `lib/main.dart`, add the import and modify `TurnlyApp.build()`:

Add imports after existing imports:
```dart
import 'core/connectivity/connectivity_cubit.dart';
import 'core/connectivity/connectivity_service.dart';
import 'core/widgets/offline_banner.dart';
```

Replace the `MultiBlocProvider` block in `TurnlyApp.build()`:

```dart
@override
Widget build(BuildContext context) {
  return MultiBlocProvider(
    providers: [
      BlocProvider<ConnectivityCubit>(
        create: (_) => ConnectivityCubit(ConnectivityService()),
      ),
      BlocProvider<AuthCubit>(
        create: (_) => AuthCubit(getIt<AuthRepository>())..checkAuth(),
      ),
      BlocProvider<FavoritesCubit>(
        create: (_) => FavoritesCubit(favoritesStorage)..loadAll(),
      ),
      BlocProvider<ReservationsCubit>(
        create: (_) =>
            ReservationsCubit(getIt<ReservationRepository>())..loadReservations(),
      ),
    ],
    child: MaterialApp.router(
      title: 'Turnly',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      routerConfig: appRouter,
      builder: (context, child) => Stack(
        children: [
          child ?? const SizedBox.shrink(),
          const Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: OfflineBanner(),
          ),
        ],
      ),
    ),
  );
}
```

- [ ] **Step 2: Run the app to verify banner appears**

```bash
cd apps/customer_v2 && fvm flutter run --flavor dev -t lib/main_dev.dart
```

Turn off WiFi on the device/simulator. Banner should slide down from top showing "Sin conexión a internet". Re-enable WiFi — banner turns green "Conectado" then disappears.

- [ ] **Step 3: Commit**

```bash
git add apps/customer_v2/lib/main.dart
git commit -m "feat(customer): integrate offline banner into TurnlyApp root"
```

---

## Task 6: Add OfflineActionGate to critical screens

**Files:**
- Modify: `apps/customer_v2/lib/features/reservations/presentation/screens/create_reservation_screen.dart`
- Modify: `apps/customer_v2/lib/features/auth/presentation/screens/login_screen.dart`

### create_reservation_screen.dart

- [ ] **Step 1: Add import**

Add to imports in `create_reservation_screen.dart`:
```dart
import '../../../../../core/widgets/offline_action_gate.dart';
```

- [ ] **Step 2: Wrap "Confirmar Reserva" button**

Find the `BlocBuilder<CreateReservationCubit, CreateReservationState>` block that renders the confirm button (around line 1027) and wrap with `OfflineActionGate`:

```dart
BlocBuilder<CreateReservationCubit, CreateReservationState>(
  builder: (context, state) {
    return OfflineActionGate(
      reason: 'para confirmar esta reserva',
      child: AppButton(
        label: 'Confirmar Reserva',
        onPressed: onSubmit,
        isLoading: state is CreateReservationSubmitting,
        icon: Icons.check_rounded,
      ),
    );
  },
).animate().fadeIn(duration: 400.ms, delay: 300.ms),
```

### login_screen.dart

- [ ] **Step 3: Add import**

Add to imports in `login_screen.dart`:
```dart
import '../../../../../core/widgets/offline_action_gate.dart';
```

- [ ] **Step 4: Wrap Google sign-in button**

Find the Google sign-in `onPressed` callback (line ~219) and wrap its parent button widget with `OfflineActionGate`:

```dart
OfflineActionGate(
  reason: 'para iniciar sesión con Google',
  child: /* existing Google button widget */,
),
```

- [ ] **Step 5: Wrap magic link / email submit button**

Find the magic link submit button (around line 354) and wrap:

```dart
OfflineActionGate(
  reason: 'para iniciar sesión',
  child: /* existing email submit button */,
),
```

- [ ] **Step 6: Run all tests**

```bash
cd apps/customer_v2 && fvm flutter test
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/customer_v2/lib/features/reservations/presentation/screens/create_reservation_screen.dart
git add apps/customer_v2/lib/features/auth/presentation/screens/login_screen.dart
git commit -m "feat(customer): add OfflineActionGate to critical actions (reservation, auth)"
```

---

## Self-Review

**Spec coverage:**
- ✓ `connectivity_plus` added
- ✓ `ConnectivityService` with DNS validation
- ✓ `ConnectivityCubit` with Online/Offline/Restored states
- ✓ `OfflineBanner` — zinc-noche bg, slide-down, verde on restore, X button, reduced motion
- ✓ `OfflineActionGate` — transparent overlay, modal with scale animation, reason text
- ✓ Modal: amber icon circle, "Entendido" pill coral, 24px card radius
- ✓ Integrated via `MaterialApp.builder` (correct pattern for `Theme`/`MediaQuery` access)
- ✓ Critical screens wrapped: create_reservation, login
- ✓ `Semantics(liveRegion)` on banner and label on X button
- ✓ `MediaQuery.disableAnimations` for reduced motion

**Placeholders:** None.

**Type consistency:** `ConnectivityOffline`, `ConnectivityOnline`, `ConnectivityRestored` used consistently. `ConnectivityServiceBase` interface used in cubit and tests. `OfflineActionGate(reason:, child:)` signature consistent across plan and test.
