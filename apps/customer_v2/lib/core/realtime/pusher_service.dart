// lib/core/realtime/pusher_service.dart
import 'dart:async';
import 'dart:convert';

import 'package:dart_pusher_channels/dart_pusher_channels.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

import '../network/api_client.dart';
import '../storage/secure_storage.dart';

typedef ReservationUpdatedCallback = void Function(Map<String, dynamic> payload);

/// Singleton that owns the Reverb (Pusher-compatible) connection for the
/// customer app. Subscribes to `private-customer.{userId}` so the backend can
/// push reservation state changes without us polling.
///
/// Uses `dart_pusher_channels` (pure Dart) with `PusherChannelsOptions.fromHost`
/// because our Reverb is self-hosted at `{scheme}://{host}:{port}/app/{key}`.
/// The previous `pusher_channels_flutter` client only accepted a Pusher
/// `cluster` and could not target a custom host — it hung in CONNECTING forever
/// and never delivered events.
class PusherService {
  PusherService._();
  static final PusherService instance = PusherService._();

  PusherChannelsClient? _client;
  PrivateChannel? _channel;
  StreamSubscription<void>? _connSub;
  StreamSubscription<ChannelReadEvent>? _eventSub;

  bool _started = false;
  String? _currentUserId;
  ReservationUpdatedCallback? _onReservationUpdated;

  final StreamController<Map<String, dynamic>> _reservationUpdatesController =
      StreamController<Map<String, dynamic>>.broadcast();

  /// Fires the full payload of every `reservation.updated` event. Multiple
  /// widgets can listen (e.g. the reservations list AND an open detail screen).
  Stream<Map<String, dynamic>> get reservationUpdates =>
      _reservationUpdatesController.stream;

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
    final port = int.tryParse(dotenv.env['REVERB_PORT'] ?? '443') ?? 443;
    final scheme = dotenv.env['REVERB_SCHEME'] ?? 'https';
    if (key == null || host == null) {
      if (kDebugMode) debugPrint('[Pusher] missing REVERB env, skipping');
      return;
    }
    final wsScheme = scheme == 'https' ? 'wss' : 'ws';

    final token = await SecureStorage.getToken();
    final tenantSlug = await SecureStorage.getTenantSlug();
    final authEndpoint =
        '${ApiClient.baseUrl.replaceFirst(RegExp(r'/v1/?$'), '')}/broadcasting/auth';

    try {
      final options = PusherChannelsOptions.fromHost(
        scheme: wsScheme,
        host: host,
        key: key,
        port: port,
        metadata: const PusherChannelsOptionsMetadata.byDefault(),
      );

      final client = PusherChannelsClient.websocket(
        options: options,
        connectionErrorHandler: (exception, trace, refresh) {
          if (kDebugMode) debugPrint('[Pusher] connection error: $exception');
          refresh();
        },
      );
      _client = client;

      final channel = client.privateChannel(
        'private-customer.$userId',
        authorizationDelegate:
            EndpointAuthorizableChannelTokenAuthorizationDelegate
                .forPrivateChannel(
          authorizationEndpoint: Uri.parse(authEndpoint),
          headers: {
            if (token != null) 'Authorization': 'Bearer $token',
            if (tenantSlug != null) 'X-Tenant': tenantSlug,
          },
          onAuthFailed: (exception, trace) {
            if (kDebugMode) debugPrint('[Pusher] auth failed: $exception');
          },
        ),
      );
      _channel = channel;

      _eventSub = channel.bind('reservation.updated').listen((event) {
        final payload = _parsePayload(event.data);
        if (kDebugMode) {
          debugPrint(
              '[Pusher] reservation.updated id=${payload['id']} status=${payload['status']}');
        }
        _onReservationUpdated?.call(payload);
        if (!_reservationUpdatesController.isClosed) {
          _reservationUpdatesController.add(payload);
        }
      });

      // Subscribe on (re)connection so a reconnect re-subscribes automatically.
      _connSub = client.onConnectionEstablished.listen((_) {
        if (kDebugMode) debugPrint('[Pusher] connected; subscribing');
        channel.subscribeIfNotUnsubscribed();
      });

      await client.connect();
      _started = true;
      if (kDebugMode) {
        debugPrint(
            '[Pusher] connect() called host=$host:$port channel=private-customer.$userId');
      }
    } catch (e, st) {
      if (kDebugMode) debugPrint('[Pusher] start failed: $e\n$st');
    }
  }

  Map<String, dynamic> _parsePayload(dynamic data) {
    if (data is Map<String, dynamic>) return data;
    if (data is String && data.isNotEmpty) {
      try {
        final decoded = jsonDecode(data);
        return decoded is Map<String, dynamic>
            ? decoded
            : <String, dynamic>{'raw': data};
      } catch (_) {
        return <String, dynamic>{'raw': data};
      }
    }
    return <String, dynamic>{};
  }

  Future<void> stop() async {
    try {
      await _eventSub?.cancel();
      await _connSub?.cancel();
      _channel?.unsubscribe();
      _client?.dispose();
    } catch (e) {
      if (kDebugMode) debugPrint('[Pusher] stop failed: $e');
    }
    _eventSub = null;
    _connSub = null;
    _channel = null;
    _client = null;
    _started = false;
    _currentUserId = null;
    _onReservationUpdated = null;
  }
}
