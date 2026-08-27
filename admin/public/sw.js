self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = { title: 'Seu Percurso', body: 'Nova comissão recebida!', icon: '/icone_notificacao.jpg' };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {}

  const options = {
    body: data.body || 'Nova comissão recebida!',
    icon: '/icone_notificacao.jpg',
    badge: '/icone_notificacao.jpg',
    vibrate: [200, 100, 200, 100, 200],
    data: { url: '/' },
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Seu Percurso', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
