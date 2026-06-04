// lib/core/realtime/pusher_service.dart
import 'package:flutter/foundation.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:pusher_channels_flutter/pusher_channels_flutter.dart';

import '../network/api_client.dart';
import '../storage/secure_storage.dart';

typedef ReservationUpdatedCallback = void Function(Map<String, dynamic> payload);

/// Singleton that owns the Reverb (Pusher-compatible) connection for the
/// customer app. Subscribes to `private-customer.{userId}` so the backend
/// can push reservation state changes without us polling.
class PusherService {
  PusherService._();
  static final PusherService instance = PusherService._();

  final PusherChannelsFlutter _pusher = PusherChannelsFlutter.getInstance();
  bool _started = false;
  String? _currentUserId;
  ReservationUpdatedCallback? _onReservationUpdated;

  Future<void> start({
    required String userId,
    ReservationUpdatedCallback? onReservationUpdated,
  }) async {
    if (_started && _currentUserId == userId) {
      _onReservationUpdated = onReservationUpdated;
      return;
    }
    if (_started) {
      await stop();
    }

    _onReservationUpdated = onReservationUpdated;
    _currentUserId = userId;

    final key = dotenv.env['REVERB_APP_KEY'];
    final host = dotenv.env['REVERB_HOST'];
    final port = int.tryParse(dotenv.env['REVERB_PORT'] ?? '8080') ?? 8080;
    final scheme = dotenv.env['REVERB_SCHEME'] ?? 'http';
    if (key == null || host == null) {
      if (kDebugMode) debugPrint('[Pusher] missing REVERB env, skipping');
      return;
    }

    final useTls = scheme == 'https';
    final authEndpoint =
        ApiClient.baseUrl.replaceFirst(RegExp(r'/v1/?$'), '') + '/broadcasting/auth';

    try {
      await _pusher.init(
        apiKey: key,
        cluster: 'mt1', // ignored by Reverb but required by SDK
        useTLS: useTls,
        wsHost: host,
        wsPort: port,
        wssPort: port,
        onAuthorizer: (channelName, socketId, options) async {
          final token = await SecureStorage.getToken();
          final tenantSlug = await SecureStorage.getTenantSlug();
          final headers = <String, String>{
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            if (token != null) 'Authorization': 'Bearer $token',
            if (tenantSlug != null) 'X-Tenant': tenantSlug,
          };
          // The Pusher Flutter SDK does the HTTP POST for us when we return
          // null + provide headers via options. Easiest: fire the request
          // ourselves and return the parsed body.
          final response = await _authorize(
            authEndpoint: authEndpoint,
            headers: headers,
            socketId: socketId,
            channelName: channelName,
          );
          return response;
        },
        onEvent: (event) {
          if (event.eventName == 'reservation.updated') {
            final data = event.data;
            if (data is Map<String, dynamic>) {
              _onReservationUpdated?.call(data);
            } else if (data is String) {
              _onReservationUpdated?.call({'raw': data});
            } else {
              _onReservationUpdated?.call(<String, dynamic>{});
            }
          }
        },
        onError: (message, code, error) {
          if (kDebugMode) debugPrint('[Pusher] error $code: $message');
        },
      );

      await _pusher.connect();
      await _pusher.subscribe(channelName: 'private-customer.$userId');
      _started = true;
    } catch (e, st) {
      if (kDebugMode) debugPrint('[Pusher] start failed: $e\n$st');
    }
  }

  Future<Map<String, dynamic>?> _authorize({
    required String authEndpoint,
    required Map<String, String> headers,
    required String socketId,
    required String channelName,
  }) async {
    // Use Dio to inherit retry/timeout config from the rest of the app.
    try {
      final response = await ApiClient.instance.postUri(
        Uri.parse(authEndpoint),
        data: {
          'socket_id': socketId,
          'channel_name': channelName,
        },
        options: ApiClient.instance.options.copyWith(
          headers: headers,
          contentType: 'application/x-www-form-urlencoded',
        ),
      );
      final data = response.data;
      if (data is Map<String, dynamic>) return data;
      return null;
    } catch (e) {
      if (kDebugMode) debugPrint('[Pusher] auth failed: $e');
      return null;
    }
  }

  Future<void> stop() async {
    if (!_started) return;
    try {
      if (_currentUserId != null) {
        await _pusher.unsubscribe(channelName: 'private-customer.$_currentUserId');
      }
      await _pusher.disconnect();
    } catch (e) {
      if (kDebugMode) debugPrint('[Pusher] stop failed: $e');
    }
    _started = false;
    _currentUserId = null;
    _onReservationUpdated = null;
  }
}
