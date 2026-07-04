const CACHE_NAME = 'turnly-v3';

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

  if (data.action_type === 'reservation_detail') {
    url = data.action_id ? `/reservations/${data.action_id}` : '/reservations';
  }

  event.waitUntil((async () => {
    const target = new URL(url, self.location.origin).href;
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });

    // Installed PWA is usually already open: focus it and navigate, because
    // a bare openWindow() no-ops when a window for this app already exists.
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin) {
        await client.focus();
        if ('navigate' in client) {
          try { await client.navigate(target); } catch (_) { /* nav may reject; window is focused */ }
        }
        return;
      }
    }

    if (clients.openWindow) await clients.openWindow(target);
  })());
});
