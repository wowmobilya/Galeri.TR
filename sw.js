const VERSION    = 'v22';
const CACHE_NAME = `wow-mobilya-${VERSION}`;

self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', e  => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request, { cache:'no-cache' })
      .then(r => {
        if (r.ok) caches.open(CACHE_NAME).then(c=>c.put(event.request,r.clone()));
        return r;
      })
      .catch(() => caches.match(event.request))
  );
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

/* ════════════════════════════════════════
   ★ PUSH — يعمل على الكمبيوتر والهاتف
════════════════════════════════════════ */
self.addEventListener('push', event => {

  /* ★ القيم الافتراضية ★ */
  let d = {
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

  /* ★ قراءة الـ payload ★ */
  if (event.data) {
    try { d = { ...d, ...event.data.json() }; }
    catch(e) { console.warn('[SW] parse error:', e); }
  }

  /* ★ العنوان = اسم المرسل ★ */
  const title = d.sender || d.title || 'WOW MOBİLYA';

  /* ★ النص = محتوى الرسالة ★ */
  let body = d.body || 'Yeni mesaj';
  if (d.msgType==='image') body = '📷 Fotoğraf gönderdi';
  if (d.msgType==='audio') body = '🎤 Ses mesajı gönderdi';
  if (d.msgType==='video') body = '🎥 Video gönderdi';
  if (d.msgType==='file')  body = '📎 Dosya gönderdi';

  /* ★ اسم الغرفة في النص ★ */
  const fullBody = d.roomName ? `${body}` : body;

  const count = d.unreadCount || 1;

  /* ★ خيارات الإشعار ★ */
  const options = {
    body    : fullBody,
    icon    : d.icon,
    badge   : d.badge,
    tag     : d.tag || `room-${d.roomId||'wow'}`,
    renotify: true,
    silent  : false,
    vibrate : [200, 100, 200],
    data    : {
      url        : d.url    || './',
      roomId     : d.roomId || null,
      sender     : d.sender || '',
      roomName   : d.roomName || '',
      unreadCount: count
    },
    actions: [
      {
        action: 'open',
        title : count > 1 ? `📩 ${count} Okunmamış` : '📩 Mesajı Gör'
      },
      { action:'dismiss', title:'✖ Kapat' }
    ]
  };

  /* ★ badge الهاتف ★ */
  if ('setAppBadge' in self.registration) {
    self.registration.setAppBadge(count).catch(()=>{});
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

/* ════════════════════════════════════════
   ★ نقر الإشعار
════════════════════════════════════════ */
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'dismiss') {
    if ('clearAppBadge' in self.registration)
      self.registration.clearAppBadge().catch(()=>{});
    return;
  }

  const { url, roomId } = event.notification.data || {};

  event.waitUntil(
    clients.matchAll({ type:'window', includeUncontrolled:true })
      .then(list => {
        for (const c of list) {
          if (c.url.includes(self.location.origin) && 'focus' in c) {
            if (roomId) c.postMessage({ type:'NOTIFICATION_CLICK', roomId });
            return c.focus();
          }
        }
        return clients.openWindow(url || './');
      })
  );
});
