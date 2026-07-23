self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Palette Creator';
  const options = {
    body: data.body || '',
    icon: '/vite.svg',
    badge: '/vite.svg',
    tag: data.tag || 'chat',
    data: data.url || '/',
    silent: data.silent || false,
    vibrate: data.vibrate || [200, 100, 200]
  };
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.notification.data && event.notification.data !== '/silent') {
    event.waitUntil(clients.openWindow(event.notification.data));
  }
});
