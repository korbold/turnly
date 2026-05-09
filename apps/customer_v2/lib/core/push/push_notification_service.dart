// lib/core/push/push_notification_service.dart
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

    // Register token. iOS needs APNS to issue an FCM token; if the APNS
    // auth key isn't uploaded to Firebase yet, skip silently so the app
    // keeps booting. Android isn't gated by APNS.
    try {
      if (Platform.isIOS) {
        // Wait briefly for APNS to attach. On the first cold launch this
        // can take a few seconds while iOS provisions the device with APN.
        String? apns;
        for (var i = 0; i < 5 && apns == null; i++) {
          apns = await _messaging.getAPNSToken();
          if (apns == null) {
            await Future.delayed(const Duration(milliseconds: 600));
          }
        }
        if (apns == null) {
          // No APNS yet — likely missing APNS auth key in Firebase or
          // running on simulator. Don't crash, just skip.
          return;
        }
      }
      final token = await _messaging.getToken();
      if (token != null) {
        await _registerToken(token);
      }
    } catch (_) {
      // Push isn't critical for app boot; missing config will be visible
      // in Firebase Console (Cloud Messaging → APNS) when needed.
    }

    // Token refresh
    _messaging.onTokenRefresh.listen(_registerToken);
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
