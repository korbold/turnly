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
