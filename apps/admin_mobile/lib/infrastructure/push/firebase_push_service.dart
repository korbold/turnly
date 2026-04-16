import 'package:firebase_messaging/firebase_messaging.dart';

class FirebasePushService {
  final FirebaseMessaging _messaging;

  FirebasePushService({FirebaseMessaging? messaging})
      : _messaging = messaging ?? FirebaseMessaging.instance;

  Future<String?> init() async {
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    if (settings.authorizationStatus == AuthorizationStatus.denied) {
      return null;
    }

    final token = await _messaging.getToken();

    // Handle foreground messages
    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

    // Handle background/terminated message taps
    FirebaseMessaging.onMessageOpenedApp.listen(_handleMessageOpenedApp);

    return token;
  }

  Future<void> subscribeToTenant(String tenantSlug) async {
    await _messaging.subscribeToTopic('tenant_$tenantSlug');
  }

  Future<void> unsubscribeFromTenant(String tenantSlug) async {
    await _messaging.unsubscribeFromTopic('tenant_$tenantSlug');
  }

  void _handleForegroundMessage(RemoteMessage message) {
    // Foreground message handling can be extended by consumers
  }

  void _handleMessageOpenedApp(RemoteMessage message) {
    // Background tap handling can be extended by consumers
  }
}
