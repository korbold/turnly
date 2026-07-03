import Flutter
import UIKit
import UserNotifications

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    // Without this explicit call, iOS skips APNs registration whenever
    // the notification permission was already granted on a previous
    // install. Result: getAPNSToken() stayed null in Flutter and the
    // push handshake never completed. Firebase Messaging's swizzling
    // catches the resulting device-token callback either way.
    UNUserNotificationCenter.current().delegate = self
    application.registerForRemoteNotifications()
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  override func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
  ) {
    let tokenHex = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
    NSLog("[APNs] device token received: \(tokenHex.prefix(20))…")
    super.application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)
  }

  override func application(
    _ application: UIApplication,
    didFailToRegisterForRemoteNotificationsWithError error: Error
  ) {
    NSLog("[APNs] registration FAILED: \(error.localizedDescription)")
    NSLog("[APNs] error details: \(error)")
    super.application(application, didFailToRegisterForRemoteNotificationsWithError: error)
  }

  // Fires when a push is DELIVERED by APNs while the app is in the foreground.
  // If this logs, APNs delivery works and the problem is only foreground display.
  // Returning presentation options forces the system banner even in foreground.
  override func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    NSLog("[APNs] willPresent (foreground delivery): \(notification.request.content.userInfo)")
    if #available(iOS 14.0, *) {
      completionHandler([.banner, .list, .sound, .badge])
    } else {
      completionHandler([.alert, .sound, .badge])
    }
  }

  // Fires when a remote notification is received (background/data payloads).
  override func application(
    _ application: UIApplication,
    didReceiveRemoteNotification userInfo: [AnyHashable: Any],
    fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
  ) {
    NSLog("[APNs] didReceiveRemoteNotification: \(userInfo)")
    super.application(application, didReceiveRemoteNotification: userInfo, fetchCompletionHandler: completionHandler)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
  }
}
