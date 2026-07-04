// Firebase Messaging Service Worker - v3
// Config is automatically provided by the Firebase SDK when the service worker
// is registered via getToken(). No manual firebase.initializeApp() needed
// when using the modular SDK's getToken with vapidKey.
//
// For background message handling, we use the compat SDK which auto-configures
// from the main app's Firebase instance.

importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js');

// The Firebase SDK automatically sends the config to the service worker
// when using getToken() from the main thread. If that hasn't happened yet,
// initialize with the project's public config.
if (!firebase.apps.length) {
  firebase.initializeApp({
    apiKey: 'AIzaSyCdkYmtOYBIVqW7KC3cyrYtA_pqVDgKpvg',
    authDomain: 'turnly-services.firebaseapp.com',
    projectId: 'turnly-services',
    storageBucket: 'turnly-services.firebasestorage.app',
    messagingSenderId: '624883049252',
    appId: '1:624883049252:web:0e9804053703606aab09b1',
  });
}

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'Turnly';
  const options = {
    body: payload.notification?.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: payload.data,
  };

  self.registration.showNotification(title, options);
});

// iOS 16.4+ PWA: handle raw Web Push events (Firebase compat doesn't cover iOS)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {};
  try { payload = event.data.json(); } catch { return; }

  const notification = payload.notification || {};
  const title = notification.title || 'Turnly';
  const options = {
    body: notification.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: payload.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  let url = '/dashboard';

  if (data.action_type === 'reservation_detail') {
    url = data.action_id ? `/reservations/${data.action_id}` : '/reservations';
  }

  event.waitUntil((async () => {
    const target = new URL(url, self.location.origin).href;
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });

    // Reuse an already-open PWA window: focus it and navigate to the target.
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin) {
        await client.focus();
        if ('navigate' in client) {
          try { await client.navigate(target); } catch (_) { /* cross-doc nav may reject; window is focused */ }
        }
        return;
      }
    }

    if (clients.openWindow) await clients.openWindow(target);
  })());
});
