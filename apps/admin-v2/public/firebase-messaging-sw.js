// Firebase Messaging Service Worker
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
    icon: '/icon-192x192.png',
    data: payload.data,
  };

  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data;
  let url = '/dashboard';

  if (data?.action_type === 'reservation_detail') {
    url = '/reservations';
  }

  event.waitUntil(clients.openWindow(url));
});
