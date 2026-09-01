self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {
    title: 'Seu Percurso',
    body: 'Nova comissão recebida!',
    icon: '/icone_notificacao.jpg',
    url: '/financeiro',
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch (e) {
    try {
      data.body = event.data.text();
    } catch (err) {}
  }

  const options = {
    body: data.body || 'Nova comissão recebida!',
    icon: data.icon || '/icone_notificacao.jpg',
    badge: data.badge || '/icone_notificacao.jpg',
    vibrate: [300, 100, 300, 100, 300],
    tag: 'comissao_' + Date.now(),
    renotify: true,
    data: {
      url: data.data?.url || data.url || '/financeiro',
    },
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Seu Percurso', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/financeiro';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
