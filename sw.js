const VERSION    = 'v17';
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
   ★ PUSH — استقبال وعرض الإشعار
════════════════════════════════════════ */
self.addEventListener('push', event => {

  /* قيم افتراضية */
  let data = {
    title      : 'WOW MOBİLYA',
    body       : 'Yeni mesajınız var 💬',
    icon       : 'https://up6.cc/2026/04/177712738518231.png',
    badge      : 'https://up6.cc/2026/04/177712738518231.png',
    count      : 1,
    unreadCount: 1,
    sender     : '',
    roomName   : '',
    roomId     : null,
    url        : './',
    tag        : 'wow-msg',
    timestamp  : Date.now()
  };

  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch(e) {}

  const count = data.unreadCount || data.count || 1;

  /* ── نص الزر الذكي ── */
  const actionLabel = count > 1
    ? `📩 ${count} Okunmamış Mesaj`
    : `📩 Mesajı Gör`;

  const options = {
    body             : data.body,
    icon             : data.icon,
    badge            : data.badge,
    tag              : data.tag || 'wow-msg',
    renotify         : true,
    requireInteraction: false,
    silent           : false,
    vibrate          : [200, 100, 200, 100, 200],
    timestamp        : data.timestamp || Date.now(),
    data             : {
      url        : data.url    || './',
      roomId     : data.roomId || null,
      sender     : data.sender || '',
      roomName   : data.roomName || '',
      unreadCount: count
    },
    actions: [
      { action: 'open',    title: actionLabel },
      { action: 'dismiss', title: '✖ Kapat'  }
    ]
  };

  /* ── تحديث badge عدد الرسائل ── */
  if ('setAppBadge' in self.registration) {
    self.registration.setAppBadge(count).catch(() => {});
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

/* ════════════════════════════════════════
   ★ نقر على الإشعار
════════════════════════════════════════ */
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'dismiss') {
    /* مسح badge عند الإغلاق */
    if ('clearAppBadge' in self.registration) {
      self.registration.clearAppBadge().catch(() => {});
    }
    return;
  }

  const targetUrl = event.notification.data?.url || './';
  const roomId    = event.notification.data?.roomId;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        /* إذا التطبيق مفتوح — ركّز عليه وأرسل له الغرفة */
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.postMessage({
              type  : 'NOTIFICATION_CLICK',
              roomId: roomId,
              action: 'open_room'
            });
            return client.focus();
          }
        }
        /* التطبيق مغلق — افتحه */
        if (clients.openWindow) {
          return clients.openWindow(
            roomId ? `${targetUrl}#room=${roomId}` : targetUrl
          );
        }
      })
  );
});

/* ════════════════════════════════════════
   ★ إغلاق الإشعار
════════════════════════════════════════ */
self.addEventListener('notificationclose', event => {
  /* تتبع الإشعارات المغلقة (اختياري) */
  console.log('[SW] إشعار أُغلق:', event.notification.tag);
});
