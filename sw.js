const VERSION    = 'v15';
const CACHE_NAME = `wow-mobilya-${VERSION}`;
const CORE_ASSETS = ['./', './index.html'];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(CORE_ASSETS).catch(() => {})
    )
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request, { cache: 'no-cache' })
      .then(response => {
        if (response.ok) {
          caches.open(CACHE_NAME).then(cache =>
            cache.put(event.request, response.clone())
          );
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

/* ════════════════════════════════════════
   ★ PUSH NOTIFICATIONS
════════════════════════════════════════ */
self.addEventListener('push', event => {
  let data = {
    title : 'WOW MOBİLYA',
    body  : 'Yeni mesajınız var 💬',
    icon  : 'https://up6.cc/2026/04/177712738518231.png',
    badge : 'https://up6.cc/2026/04/177712738518231.png',
    count : 1
  };

  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch(e) {}

  const count = data.count || 1;

  const options = {
    body    : data.body,
    icon    : data.icon,
    badge   : data.badge,
    tag     : data.tag || 'wow-msg',
    renotify: true,
    requireInteraction: false,
    vibrate : [200, 100, 200],
    data    : {
      url    : data.url    || './',
      roomId : data.roomId || null
    },
    actions : [
      { action: 'open',    title: `📩 ${count} Mesaj` },
      { action: 'dismiss', title: '✖ Kapat'            }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || './';
  const roomId    = event.notification.data?.roomId;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            if (roomId) {
              client.postMessage({ type: 'NOTIFICATION_CLICK', roomId });
            }
            return client.focus();
          }
        }
        if (clients.openWindow) return clients.openWindow(targetUrl);
      })
  );
});

