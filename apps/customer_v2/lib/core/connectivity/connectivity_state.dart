// lib/core/connectivity/connectivity_state.dart
sealed class ConnectivityState {}

class ConnectivityOnline extends ConnectivityState {}

class ConnectivityOffline extends ConnectivityState {}

/// Transient: emitted on reconnect. Auto-transitions to [ConnectivityOnline] after 1.5s.
class ConnectivityRestored extends ConnectivityState {}
