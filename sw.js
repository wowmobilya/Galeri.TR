const VERSION    = 'v25';
const CACHE_NAME = `wow-mobilya-${VERSION}`;
const CORE_ASSETS = ['./', './index.html'];

/* ══════════════════════════════════════════
   INSTALL
══════════════════════════════════════════ */
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS).catch(() => {}))
  );
});

/* ══════════════════════════════════════════
   ACTIVATE
══════════════════════════════════════════ */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ══════════════════════════════════════════
   FETCH
══════════════════════════════════════════ */
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request, { cache: 'no-cache' })
      .then(response => {
        if (response.ok) {
          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, response.clone()));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

/* ══════════════════════════════════════════
   MESSAGE
══════════════════════════════════════════ */
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

/* ══════════════════════════════════════════
   ★ PUSH — النسخة الذكية الكاملة
══════════════════════════════════════════ */

/* ── تحديد أيقونة + نص حسب النوع ── */
function getMediaInfo(mediaType, fileName) {
  switch (mediaType) {
    case 'image': return { emoji: '📷', text: 'Fotoğraf gönderdi' };
    case 'video': return { emoji: '🎥', text: 'Video gönderdi' };
    case 'audio': return { emoji: '🎤', text: 'Ses mesajı gönderdi' };
    case 'file':  return { emoji: '📎', text: fileName ? `📎 ${fileName}` : 'Dosya gönderdi' };
    default:      return { emoji: '💬', text: '' };
  }
}

/* ── مخزن عدد الإشعارات المعلقة ── */
let _pendingCount = 0;

self.addEventListener('push', event => {
  /* ── 1. قراءة البيانات ── */
  let data = {};
  try {
    if (event.data) data = event.data.json();
  } catch(e) {
    console.error('[SW Push] parse error:', e);
  }

  const {
    title          = 'WOW MOBİLYA',
    body           = '',
    url            = './',
    roomId         = null,
    count          = 1,
    mediaType      = 'text',
    senderUsername = '',
    fileName       = '',
    icon           = 'https://up6.cc/2026/04/177712738518231.png',
    badge          = 'https://up6.cc/2026/04/177712738518231.png',
  } = data;

  /* ── 2. بناء نص الجسم الذكي ── */
  const mediaInfo = getMediaInfo(mediaType, fileName);
  let finalBody   = body;

  // إذا لم يكن نصاً عادياً → استخدم النص الذكي
  if (mediaType !== 'text' || !finalBody.trim()) {
    finalBody = mediaInfo.text || 'Yeni mesajınız var';
  }

  // اقتطاع النص الطويل
  if (finalBody.length > 100) {
    finalBody = finalBody.substring(0, 100) + '…';
  }

  /* ── 3. تحديث العداد المحلي ── */
  _pendingCount = Math.max(_pendingCount, Number(count) || 1);

  /* ── 4. tag ديناميكي — إشعار منفصل لكل مرسل ── */
  let notifTag = 'wow-chat';
  if (senderUsername) notifTag = `wow-sender-${senderUsername}`;
  else if (roomId)    notifTag = `wow-room-${roomId}`;

  /* ── 5. خيارات الإشعار ── */
  const options = {
    body    : finalBody,
    icon,
    badge,
    tag     : notifTag,
    renotify: true,          // ← صوت + اهتزاز مع كل رسالة جديدة
    vibrate : [200, 100, 200, 100, 200],
    silent  : false,
    requireInteraction: false,
    data: {
      url,
      roomId,
      senderUsername,
      mediaType,
      count: _pendingCount
    },
    // ★ actions تظهر على Android فقط
    actions: [
      { action: 'open',    title: '💬 Aç'     },
      { action: 'dismiss', title: '✕ Kapat'   }
    ]
  };

  /* ── 6. تنفيذ كل العمليات معاً ── */
  event.waitUntil(
    Promise.all([

      /* أ. إظهار الإشعار */
      self.registration.showNotification(title, options),

      /* ب. ★ تحديث الرقم على الأيقونة
            - self.navigator (وليس navigator) داخل SW
            - هذا هو السبب الرئيسي لعدم تغيّر الرقم! */
      (async () => {
        try {
          if ('setAppBadge' in self.navigator) {
            await self.navigator.setAppBadge(_pendingCount);
          }
        } catch(e) {
          console.warn('[SW Badge]', e);
        }
      })(),

      /* ج. إبلاغ التطبيق المفتوح */
      self.clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type          : 'UPDATE_UI_COUNTER',
              count         : _pendingCount,
              roomId,
              mediaType,
              senderUsername
            });
          });
        })

    ]).catch(err => console.error('[SW Push] error:', err))
  );
});

/* ══════════════════════════════════════════
   ★ NOTIFICATION CLICK
══════════════════════════════════════════ */
self.addEventListener('notificationclick', event => {
  event.notification.close();

  /* ── تصفير الرقم عند فتح الإشعار ── */
  _pendingCount = 0;
  if ('clearAppBadge' in self.navigator) {
    self.navigator.clearAppBadge().catch(() => {});
  }

  if (event.action === 'dismiss') return;

  const { url = './', roomId, senderUsername } = event.notification.data || {};

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        /* إذا التطبيق مفتوح → ركّز عليه وأرسل له الغرفة */
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.postMessage({
              type          : 'NOTIFICATION_CLICK',
              roomId,
              senderUsername
            });
            return client.focus();
          }
        }
        /* إذا مغلق → افتح التطبيق */
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
  );
});

/* ══════════════════════════════════════════
   ★ NOTIFICATION CLOSE — تقليل العداد
══════════════════════════════════════════ */
self.addEventListener('notificationclose', event => {
  if (_pendingCount > 0) {
    _pendingCount = Math.max(0, _pendingCount - 1);
    if ('setAppBadge' in self.navigator) {
      if (_pendingCount === 0) {
        self.navigator.clearAppBadge().catch(() => {});
      } else {
        self.navigator.setAppBadge(_pendingCount).catch(() => {});
      }
    }
  }
});
