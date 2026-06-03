// lib/core/push/push_notification_service.dart
import 'dart:async';
import 'dart:convert';
import 'dart:developer' as dev;
import 'dart:io' show Platform;

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:dio/dio.dart';
import '../network/api_client.dart';
import '../storage/secure_storage.dart';

@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Background messages handled by system tray automatically
}

void _log(String msg) => dev.log(msg, name: 'PushNotificationService');

class PushNotificationService {
  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();
  final Dio _dio = ApiClient.instance;

  bool _bootstrapped = false;
  StreamSubscription<RemoteMessage>? _onMessageSub;
  StreamSubscription<String>? _onTokenRefreshSub;

  /// Boot once — wires platform handlers and asks for permission. Safe to
  /// call repeatedly; subsequent calls only refresh the device token (which
  /// is what we want after a successful login because pre-login tokens hit
  /// `/device-tokens` without auth and 401 silently).
  Future<void> init() async {
    if (!_bootstrapped) {
      final settings = await _messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      _log('permission status: ${settings.authorizationStatus}');
      if (settings.authorizationStatus == AuthorizationStatus.denied) {
        _log('user denied push permission — notifications will not arrive '
            'until they enable it in system settings.');
      }

      const androidSettings =
          AndroidInitializationSettings('@mipmap/ic_launcher');
      const iosSettings = DarwinInitializationSettings();
      const initSettings = InitializationSettings(
        android: androidSettings,
        iOS: iosSettings,
      );
      await _localNotifications.initialize(initSettings);

      FirebaseMessaging.onBackgroundMessage(
        _firebaseMessagingBackgroundHandler,
      );
      _onMessageSub = FirebaseMessaging.onMessage.listen(
        _handleForegroundMessage,
      );
      _onTokenRefreshSub = _messaging.onTokenRefresh.listen(_registerToken);

      _bootstrapped = true;
    }

    // Always re-fetch the token; init() is also called post-login to push
    // the token now that a Sanctum auth header is available.
    unawaited(_fetchTokenWhenReady());
  }

  Future<void> _fetchTokenWhenReady() async {
    try {
      if (Platform.isIOS) {
        // APNs provisioning can take longer than 3s after a fresh install
        // or the first launch following a capability change. Poll every
        // 500ms for up to 15s before bailing — the token registration
        // hook (_onTokenRefreshSub) will still pick it up later if APNs
        // shows up after this window.
        String? apns;
        for (var i = 0; i < 30; i++) {
          apns = await _messaging.getAPNSToken();
          if (apns != null) break;
          await Future.delayed(const Duration(milliseconds: 500));
        }
        if (apns == null) {
          _log('APNS token still null after 15s; will retry on next init().');
          return;
        }
        _log('APNS token ready: ${apns.substring(0, 12)}…');
      }
      final token = await _messaging.getToken();
      if (token == null) {
        _log('FCM token came back null.');
        return;
      }
      _log('FCM token: ${token.substring(0, 12)}…');
      await _registerToken(token);
    } catch (e, st) {
      _log('fetchTokenWhenReady failed: $e\n$st');
    }
  }

  void _handleForegroundMessage(RemoteMessage message) {
    final notification = message.notification;
    if (notification == null) return;

    _localNotifications.show(
      notification.hashCode,
      notification.title,
      notification.body,
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'turnly_notifications',
          'Turnly Notifications',
          channelDescription: 'Notifications from Turnly',
          importance: Importance.high,
          priority: Priority.high,
        ),
        iOS: DarwinNotificationDetails(),
      ),
      payload: jsonEncode(message.data),
    );
  }

  Future<void> _registerToken(String token) async {
    final auth = await SecureStorage.getToken();
    if (auth == null) {
      // Pre-login — registration would 401 silently. Skip; init() is
      // called again from AuthCubit on AuthAuthenticated and the token
      // will land then.
      _log('skip /device-tokens POST — no Sanctum token yet.');
      return;
    }
    try {
      final res = await _dio.post('/device-tokens', data: {
        'token': token,
        'platform': Platform.isIOS ? 'ios' : 'android',
      });
      _log('/device-tokens -> ${res.statusCode}');
    } on DioException catch (e) {
      _log('/device-tokens failed: status=${e.response?.statusCode} '
          'body=${e.response?.data}');
    } catch (e) {
      _log('/device-tokens unexpected error: $e');
    }
  }

  void dispose() {
    _onMessageSub?.cancel();
    _onTokenRefreshSub?.cancel();
    _bootstrapped = false;
  }
}
