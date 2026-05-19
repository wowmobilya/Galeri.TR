/* ★ غيّر الرقم عند كل تعديل ★ */
const VERSION    = 'v19';
const CACHE_NAME = `wow-mobilya-${VERSION}`;

self.addEventListener('install', event => {
  console.log('[SW] Installing version:', VERSION);
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('[SW] Activating version:', VERSION);
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW] Deleting old cache:', k);
          return caches.delete(k);
        })
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request, { cache: 'no-cache' })
      .then(res => {
        if (res.ok) {
          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, res.clone()));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    console.log('[SW] Skip waiting triggered');
    self.skipWaiting();
  }
});

/* ══════════════════════════════════════════
   ★ PUSH — الاستقبال والعرض
══════════════════════════════════════════ */
self.addEventListener('push', event => {
  console.log('[SW] Push received:', event);

  /* ★ القيم الافتراضية الآمنة ★ */
  let payload = {
    title      : 'WOW MOBİLYA',
    body       : 'Yeni mesajınız var 💬',
    sender     : '',
    roomName   : '',
    roomId     : null,
    unreadCount: 1,
    msgType    : 'text',
    url        : './',
    icon       : 'https://up6.cc/2026/04/177712738518231.png',
    badge      : 'https://up6.cc/2026/04/177712738518231.png',
    tag        : 'wow-msg'
  };

  /* ★ محاولة قراءة البيانات بأمان ★ */
  if (event.data) {
    try {
      const parsed = event.data.json();
      console.log('[SW] Payload parsed:', parsed);
      payload = { ...payload, ...parsed };
    } catch(e) {
      /* إذا فشل JSON — جرّب text */
      try {
        const text = event.data.text();
        console.log('[SW] Payload text:', text);
        payload.body = text || payload.body;
      } catch(e2) {
        console.warn('[SW] Cannot parse push data:', e2);
      }
    }
  } else {
    console.warn('[SW] Push event has NO data!');
  }

  /* ★ بناء العنوان = اسم المرسل ★ */
  const notifTitle = payload.sender
    ? payload.sender
    : payload.title || 'WOW MOBİLYA';

  /* ★ بناء نص الرسالة ★ */
  let notifBody = payload.body || 'Yeni mesaj';
  if (payload.msgType === 'image') notifBody = '📷 Fotoğraf gönderdi';
  if (payload.msgType === 'audio') notifBody = '🎤 Ses mesajı gönderdi';
  if (payload.msgType === 'video') notifBody = '🎥 Video gönderdi';
  if (payload.msgType === 'file')  notifBody = '📎 Dosya gönderdi';

  /* ★ إضافة اسم الغرفة للنص إذا وُجد ★ */
  if (payload.roomName) {
    notifBody = `${notifBody}`;
  }

  const count = payload.unreadCount || 1;

  const options = {
    body    : notifBody,
    icon    : payload.icon,
    badge   : payload.badge,
    tag     : payload.tag || `room-${payload.roomId || 'wow'}`,
    renotify: true,
    silent  : false,
    vibrate : [200, 100, 200],
    data    : {
      url        : payload.url    || './',
      roomId     : payload.roomId || null,
      sender     : payload.sender || '',
      roomName   : payload.roomName || '',
      unreadCount: count
    },
    actions: [
      {
        action: 'open',
        title : count > 1 ? `📩 ${count} Okunmamış` : '📩 Mesajı Gör'
      },
      { action: 'dismiss', title: '✖ Kapat' }
    ]
  };

  /* ★ تحديث badge الهاتف ★ */
  if ('setAppBadge' in self.registration) {
    self.registration.setAppBadge(count).catch(() => {});
  }

  console.log('[SW] Showing notification:', notifTitle, options);

  /* ★ event.waitUntil ضروري جداً ★ */
  event.waitUntil(
    self.registration.showNotification(notifTitle, options)
      .then(() => console.log('[SW] Notification shown successfully'))
      .catch(err => console.error('[SW] showNotification error:', err))
  );
});

/* ══════════════════════════════════════════
   ★ نقر على الإشعار
══════════════════════════════════════════ */
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification clicked:', event.action);
  event.notification.close();

  if (event.action === 'dismiss') {
    if ('clearAppBadge' in self.registration) {
      self.registration.clearAppBadge().catch(() => {});
    }
    return;
  }

  const { url, roomId } = event.notification.data || {};

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        /* التطبيق مفتوح — ركّز عليه */
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
        /* التطبيق مغلق — افتحه */
        return clients.openWindow(url || './');
      })
  );
});
