// lib/core/push/push_notification_service.dart
import 'dart:async';
import 'dart:convert';
import 'dart:io' show Platform;

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:dio/dio.dart';
import '../network/api_client.dart';

@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Background messages handled by system tray automatically
}

class PushNotificationService {
  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();
  final Dio _dio = ApiClient.instance;

  Future<void> init() async {
    // Request permission
    await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    // Setup local notifications for foreground
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings();
    const initSettings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );
    await _localNotifications.initialize(initSettings);

    // Background handler
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

    // Foreground messages
    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

    // Defer FCM token fetch off the boot hot path. iOS needs APNS to
    // provision before FCM can mint a token; doing it inline can race
    // with the engine startup and crash the DartWorker thread.
    unawaited(_fetchTokenWhenReady());

    // Token refresh
    _messaging.onTokenRefresh.listen(_registerToken);
  }

  Future<void> _fetchTokenWhenReady() async {
    try {
      if (Platform.isIOS) {
        // Single longer wait avoids the looped getAPNSToken() calls that
        // appear to race with native FCM init.
        await Future.delayed(const Duration(seconds: 3));
        final apns = await _messaging.getAPNSToken();
        if (apns == null) return;
      }
      final token = await _messaging.getToken();
      if (token != null) {
        await _registerToken(token);
      }
    } catch (_) {
      // Push isn't critical for app boot; failures are recoverable on
      // the next launch.
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
    try {
      await _dio.post('/device-tokens', data: {
        'token': token,
        'platform': Platform.isIOS ? 'ios' : 'android',
      });
    } catch (_) {
      // Silently fail — token will be re-registered on next app start
    }
  }
}
