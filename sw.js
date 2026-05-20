const VERSION    = 'v26';
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
  let data = {};
  try { if (event.data) data = event.data.json(); } catch(e) {}

  const {
    title          = 'WOW MOBİLYA',
    body           = '',
    url            = './',
    roomId         = null,
    count          = 1,
    mediaType      = 'text',
    mediaUrl       = null, // ← رابط الصورة لعرضها في الإشعار
    senderUsername = '',
    fileName       = '',
    icon           = 'https://up6.cc/2026/04/177712738518231.png',
    badge          = 'https://up6.cc/2026/04/177712738518231.png',
  } = data;

  const mediaInfo = getMediaInfo(mediaType, fileName);
  let finalBody   = body;

  if (mediaType !== 'text' || !finalBody.trim()) {
    finalBody = mediaInfo.text || 'Yeni mesajınız var';
  }
  if (finalBody.length > 100) finalBody = finalBody.substring(0, 100) + '…';

  _pendingCount = Math.max(_pendingCount, Number(count) || 1);
  let notifTag = senderUsername ? `wow-sender-${senderUsername}` : (roomId ? `wow-room-${roomId}` : 'wow-chat');

  const options = {
    body    : finalBody,
    icon,
    badge,
    image   : mediaType === 'image' ? mediaUrl : undefined, // ← عرض الصورة الكبيرة
    tag     : notifTag,
    renotify: true,
    vibrate : [200, 100, 200, 100, 200],
    data: { url, roomId, senderUsername, mediaType, count: _pendingCount },
    
    // ★ أزرار تفاعلية مثل واتساب
    actions: [
      { 
        action: 'reply', 
        title: '💬 Yanıtla (الرد)', 
        type: 'text', // ← هذا يظهر حقل إدخال نصي داخل الإشعار
        placeholder: 'Mesaj yaz...' 
      },
      { action: 'mark_read', title: '✓ Okundu (مقروء)' }
    ]
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      (async () => {
        if ('setAppBadge' in self.navigator) await self.navigator.setAppBadge(_pendingCount);
      })(),
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
        clients.forEach(c => c.postMessage({ type: 'UPDATE_UI_COUNTER', count: _pendingCount, roomId, mediaType, senderUsername }));
      })
    ])
  );
});

/* ── معالجة أزرار الإشعار ── */
self.addEventListener('notificationclick', event => {
  const notification = event.notification;
  const action       = event.action;
  const replyText    = event.reply; // النص الذي كتبه المستخدم في الإشعار
  const data         = notification.data;

  notification.close();

  if (action === 'reply' && replyText) {
    // 1. إرسال الرد مباشرة للخلفية دون فتح التطبيق
    event.waitUntil(sendReplyInBackground(data.roomId, replyText));
  } 
  else if (action === 'mark_read') {
    // 2. تصفير العداد وتحديد كمقروء
    _pendingCount = 0;
    if ('clearAppBadge' in self.navigator) self.navigator.clearAppBadge().catch(()=>{});
  } 
  else {
    // 3. فتح التطبيق عند النقر العادي
    _pendingCount = 0;
    if ('clearAppBadge' in self.navigator) self.navigator.clearAppBadge().catch(()=>{});
    
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.postMessage({ type: 'NOTIFICATION_CLICK', roomId: data.roomId, senderUsername: data.senderUsername });
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(data.url);
      })
    );
  }
});

/* ── دالة إرسال الرد من الـ Service Worker عبر REST API ── */
async function sendReplyInBackground(roomId, text) {
  // استبدل هذه بالقيم الخاصة بك
  const SUPABASE_URL = 'https://sldthbnigivpsqixccah.supabase.co';
  const SUPABASE_KEY = 'YOUR_SUPABASE_ANON_KEY'; // مفتاح الـ Anon
  
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/group_messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({
        room_id: roomId,
        from_user: 'WOW', // أو جلب اسم المستخدم المخزن في IndexedDB
        message: text,
        media_type: 'text',
        delivery_status: 'sent'
      })
    });
  } catch (error) {
    console.error('[SW] Reply failed', error);
  }
}

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
