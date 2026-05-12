const CACHE_NAME = 'turnly-v2';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Handle push events here too in case Firebase subscription was attached
// to this SW instead of firebase-messaging-sw.js (root scope race).
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
  if (data.action_type === 'reservation_detail') url = '/reservations';
  event.waitUntil(clients.openWindow(url));
});
