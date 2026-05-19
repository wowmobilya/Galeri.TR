const VERSION    = 'v18';
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
   ★ PUSH — عرض الإشعار مع بيانات كاملة
════════════════════════════════════════ */
self.addEventListener('push', event => {

  /* قيم افتراضية */
  let data = {
    title      : 'WOW MOBİLYA',
    body       : 'Yeni mesajınız var 💬',
    icon       : 'https://up6.cc/2026/04/177712738518231.png',
    badge      : 'https://up6.cc/2026/04/177712738518231.png',
    sender     : '',
    roomName   : '',
    roomId     : null,
    unreadCount: 1,
    msgType    : 'text',
    url        : './',
    tag        : 'wow-msg',
    timestamp  : Date.now()
  };

  /* ★ قراءة البيانات من الـ payload ★ */
  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch(e) {
    console.warn('[SW Push] parse error:', e);
  }

  const count = data.unreadCount || 1;

  /* ══ بناء العنوان الذكي ══ */
  let smartTitle = data.sender || 'WOW MOBİLYA';

  /* ══ بناء نص الرسالة الذكي ══ */
  let smartBody = data.body || 'Yeni mesaj';
  if (data.msgType === 'image')  smartBody = '📷 Fotoğraf gönderdi';
  if (data.msgType === 'audio')  smartBody = '🎤 Ses mesajı gönderdi';
  if (data.msgType === 'video')  smartBody = '🎥 Video gönderdi';
  if (data.msgType === 'file')   smartBody = '📎 Dosya gönderdi';

  /* ══ زر الإجراء الذكي ══ */
  const actionLabel = count > 1
    ? `📩 ${count} Okunmamış`
    : `📩 Mesajı Gör`;

  const options = {
    /* ★ العنوان = اسم المرسل ★ */
    body             : smartBody,
    icon             : data.icon,
    badge            : data.badge,
    tag              : data.tag || `room-${data.roomId || 'wow'}`,
    renotify         : true,
    requireInteraction: false,
    silent           : false,
    vibrate          : [200, 100, 200],
    timestamp        : data.timestamp || Date.now(),

    /* ★ بيانات إضافية للنقر ★ */
    data: {
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

  /* ★ تحديث badge الهاتف ★ */
  if ('setAppBadge' in self.registration) {
    self.registration.setAppBadge(count).catch(() => {});
  }

  event.waitUntil(
    /* ★ العنوان = اسم المرسل + اسم الغرفة ★ */
    self.registration.showNotification(smartTitle, options)
  );
});

/* ════════════════════════════════════════
   ★ نقر على الإشعار
════════════════════════════════════════ */
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'dismiss') {
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
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            if (roomId) {
              client.postMessage({
                type  : 'NOTIFICATION_CLICK',
                roomId: roomId,
                action: 'open_room'
              });
            }
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(
            roomId ? `${targetUrl}#room=${roomId}` : targetUrl
          );
        }
      })
  );
});

self.addEventListener('notificationclose', () => {});
