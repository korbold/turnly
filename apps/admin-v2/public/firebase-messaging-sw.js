importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: self.__FIREBASE_API_KEY,
  authDomain: self.__FIREBASE_AUTH_DOMAIN,
  projectId: self.__FIREBASE_PROJECT_ID,
  storageBucket: self.__FIREBASE_STORAGE_BUCKET,
  messagingSenderId: self.__FIREBASE_MESSAGING_SENDER_ID,
  appId: self.__FIREBASE_APP_ID,
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'Turnly';
  const options = {
    body: payload.notification?.body || '',
    icon: '/icon-192x192.png',
    data: payload.data,
  };

  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data;
  let url = '/dashboard';

  if (data?.action_type === 'reservation_detail' && data?.action_id) {
    url = '/reservations';
  }

  event.waitUntil(clients.openWindow(url));
});
