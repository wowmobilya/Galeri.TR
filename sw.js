const VERSION = 'v23';
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
   ★ PUSH NOTIFICATIONS — النسخة الذكية النهائية
════════════════════════════════════════ */

/* ── تحديد أيقونة الرسالة حسب النوع ── */
function getMediaEmoji(mediaType) {
  switch (mediaType) {
    case 'image':  return '📷 ';
    case 'video':  return '🎥 ';
    case 'audio':  return '🎤 ';
    case 'file':   return '📎 ';
    default:       return '';
  }
}

/* ── تحديد tag الإشعار ── */
function getNotifTag(data) {
  // إشعار منفصل لكل مرسل (إذا كان senderUsername موجوداً)
  if (data.senderUsername) {
    return `wow-chat-${data.senderUsername}`;
  }
  if (data.roomId) {
    return `wow-room-${data.roomId}`;
  }
  return 'wow-chat';
}

self.addEventListener('push', event => {
  let data = {};
  try {
    if (event.data) data = event.data.json();
  } catch(e) {
    console.error('[SW] Push parse error:', e);
  }

  const count          = Number(data.count) || 1;
  const mediaType      = data.mediaType || 'text';
  const senderUsername = data.senderUsername || '';
  const mediaEmoji     = getMediaEmoji(mediaType);

  /* ── بناء العنوان ── */
  let title = data.title || 'WOW MOBİLYA';

  /* ── بناء نص الجسم ── */
  let body = data.body || 'Yeni mesajınız var';

  // إضافة إيموجي النوع إذا لم يكن نصاً عادياً
  if (mediaType !== 'text' && !body.startsWith(mediaEmoji)) {
    body = mediaEmoji + body;
  }

  /* ── تحديد الـ tag ──
     كل مرسل يحصل على إشعار منفصل إذا أُرسل senderUsername */
  const notifTag = getNotifTag(data);

  const options = {
    body    : body,
    icon    : data.icon  || 'https://up6.cc/2026/04/177712738518231.png',
    badge   : data.badge || 'https://up6.cc/2026/04/177712738518231.png',
    tag     : notifTag,
    renotify: true,
    vibrate : [300, 100, 300],
    silent  : false,
    data    : {
      url          : data.url    || './',
      roomId       : data.roomId || null,
      senderUsername,
      mediaType,
      count
    }
  };

  const promises = [];

  // 1. إظهار الإشعار
  promises.push(
    self.registration.showNotification(title, options)
  );

  // 2. تحديث الرقم الأحمر على أيقونة التطبيق
  if ('setAppBadge' in self.navigator) {
    promises.push(
      self.navigator.setAppBadge(count).catch(() => {})
    );
  }

  // 3. إبلاغ التطبيق المفتوح لتحديث العداد الداخلي
  promises.push(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type  : 'UPDATE_UI_COUNTER',
            count,
            roomId: data.roomId || null,
            mediaType,
            senderUsername
          });
        });
      })
  );

  event.waitUntil(Promise.all(promises).catch(console.error));
});

/* ── النقر على الإشعار ── */
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if ('clearAppBadge' in self.navigator) {
    self.navigator.clearAppBadge().catch(() => {});
  }

  if (event.action === 'dismiss') return;

  const targetUrl      = event.notification.data?.url || './';
  const roomId         = event.notification.data?.roomId;
  const senderUsername = event.notification.data?.senderUsername;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.postMessage({
              type: 'NOTIFICATION_CLICK',
              roomId,
              senderUsername
            });
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
