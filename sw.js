const VERSION    = 'v3';
const CACHE_NAME = `wow-mobilya-${VERSION}`;
const CORE_ASSETS = ['./', './index.html'];

/* ── مفاتيح الاتصال المباشر بقاعدة البيانات ── */
const SUPABASE_URL = 'https://sldthbnigivpsqixccah.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsZHRoYm5pZ2l2cHNxaXhjY2FoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MjM3NzcsImV4cCI6MjA5MzA5OTc3N30.Ll_Fb7jVEm5eesb6JolygdPlzhwlTTKyhABh0few_xc';

/* ══════════════════════════════════════════
   INSTALL & ACTIVATE
══════════════════════════════════════════ */
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS).catch(() => {})));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request, { cache: 'no-cache' }).then(response => {
      if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
      return response;
    }).catch(() => caches.match(event.request))
  );
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

/* ══════════════════════════════════════════
   ★ PUSH NOTIFICATIONS
══════════════════════════════════════════ */
function getMediaInfo(mediaType, fileName) {
  switch (mediaType) {
    case 'image': return { emoji: '📷', text: 'Fotoğraf gönderdi' };
    case 'video': return { emoji: '🎥', text: 'Video gönderdi' };
    case 'audio': return { emoji: '🎤', text: 'Ses mesajı gönderdi' };
    case 'file':  return { emoji: '📎', text: fileName ? `📎 ${fileName}` : 'Dosya gönderdi' };
    default:      return { emoji: '💬', text: '' };
  }
}

let _pendingCount = 0;

self.addEventListener('push', event => {
  let data = {};
  try { if (event.data) data = event.data.json(); } catch(e) {}

  const {
    title            = 'WOW MOBİLYA',
    body             = '',
    url              = './',
    roomId           = null,
    count            = 1,
    mediaType        = 'text',
    mediaUrl         = null,
    senderUsername   = '',
    fileName         = '',
    receiverUsername = '', // ← استخراج اسم المستلم
   icon             = 'https://up6.cc/2026/04/177712738518231.png', // ← ستكون صورة المرسل الآن
    badge            = 'https://up6.cc/2026/04/177712738518231.png', // ← لوجو التطبيق الصغير
  } = data;

  const mediaInfo = getMediaInfo(mediaType, fileName);
  let finalBody   = body;

  if (mediaType !== 'text' || !finalBody.trim()) {
    finalBody = mediaInfo.text || 'Yeni mesajınız var';
  }
  if (finalBody.length > 100) finalBody = finalBody.substring(0, 100) + '…';

  _pendingCount = Math.max(_pendingCount, Number(count) || 1);
let notifTag = (senderUsername ? `wow-sender-${senderUsername}` : (roomId ? `wow-room-${roomId}` : 'wow-chat')) + `-${Date.now()}`;

  const options = {
    body    : finalBody,
   icon    : icon,  // ← ★ سيتم عرض صورة المرسل هنا
    badge   : badge, // ← ★ سيتم عرض لوجو التطبيق في شريط الهاتف العلوي
    image   : mediaType === 'image' ? mediaUrl : undefined,
    tag     : notifTag,
    renotify: true,
    vibrate : [200, 100, 200, 100, 200],
    data: { 
      url, 
      roomId, 
      senderUsername, 
      mediaType, 
      count: _pendingCount,
      receiverUsername // ← تمريره للبيانات
    },
    actions: [
      { action: 'reply', title: '💬 Yanıtla', type: 'text', placeholder: 'Mesaj yaz...' },
      { action: 'mark_read', title: '✓ Okundu' }
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

/* ══════════════════════════════════════════
   ★ NOTIFICATION CLICK & REPLY
══════════════════════════════════════════ */
self.addEventListener('notificationclick', event => {
  const notification = event.notification;
  const action       = event.action;
  const replyText    = event.reply; 
  const data         = notification.data || {};

  // 1. حالة الرد المباشر (Quick Reply)
  if (action === 'reply' && replyText) {
    // ⚠️ لا تغلق الإشعار هنا! دعه مفتوحاً حتى ينتهي الإرسال
    const fromUser = data.receiverUsername || 'WOW';
    
    // إرسال الرسالة وتحديث الإشعار لإيقاف الدوران
    event.waitUntil(
      sendReplyInBackground(data.roomId, replyText, fromUser, notification.tag)
    );
  } 
  // 2. حالة "تحديد كمقروء"
  else if (action === 'mark_read') {
    notification.close();
    _pendingCount = 0;
    if ('clearAppBadge' in self.navigator) self.navigator.clearAppBadge().catch(()=>{});
  } 
  // 3. النقر العادي لفتح التطبيق
  else if (action !== 'dismiss') {
    notification.close();
    _pendingCount = 0;
    if ('clearAppBadge' in self.navigator) self.navigator.clearAppBadge().catch(()=>{});
    
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
client.postMessage({ type: 'NOTIFICATION_CLICK', roomId: data.roomId, senderUsername: data.senderUsername, url: data.url });
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(data.url || './');
      })
    );
  }
});

/* ══════════════════════════════════════════
   ★ دالة إرسال الرد في الخلفية (سريعة ولحظية)
══════════════════════════════════════════ */
async function sendReplyInBackground(roomId, text, fromUser, notifTag) {
  if (!roomId || !text) return;

  // 1. إيقاف الدوران فوراً! (تحديث الإشعار قبل بدء الإرسال)
  await self.registration.showNotification('Mesaj Gönderildi ✓', {
    body: text,
    icon: 'https://up6.cc/2026/04/177712738518231.png',
    tag: notifTag, // نفس الـ tag يوقف الدوران فوراً
    silent: true
  });

  // 2. إخفاء إشعار النجاح تلقائياً بعد ثانيتين
  setTimeout(() => {
    self.registration.getNotifications({ tag: notifTag }).then(ns => {
      ns.forEach(n => n.close());
    });
  }, 2000);

  // 3. إرسال الرسالة إلى قاعدة البيانات بهدوء في الخلفية
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/group_messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        room_id: Number(roomId),
        from_user: fromUser,
        message: text,
        media_type: 'text',
        delivery_status: 'sent',
        client_msg_id: 'reply_' + Date.now()
      })
    });

    if (!response.ok) {
      throw new Error('DB Insert Failed');
    }
  } catch (error) {
    console.error('[SW] Network Error:', error);
    // في حال فشل الإرسال (لا يوجد إنترنت مثلاً)، نظهر إشعار خطأ
    await self.registration.showNotification('Gönderilemedi ❌', {
      body: 'Bağlantı hatası, tekrar deneyin.',
      icon: 'https://up6.cc/2026/04/177712738518231.png',
      tag: notifTag,
      silent: true
    });
  }
}
