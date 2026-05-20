const VERSION    = 'v21'; // تم التحديث لكسر الكاش إجبارياً
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
   ★ PUSH NOTIFICATIONS (النسخة المنيعة للهواتف)
════════════════════════════════════════ */
self.addEventListener('push', event => {
  let data = {};
  try {
    if (event.data) data = event.data.json();
  } catch(e) {
    console.error("Push parse error:", e);
  }

  const count = Number(data.count) || 1;
  let title = data.title || 'WOW MOBİLYA';
  const body  = data.body || 'Yeni mesajınız var 💬';

  // ★ 1. تحويل اسم المرسل إلى رئيس الغرفة بالتركي إذا كان wow ★
  if (title.toLowerCase().includes('wow')) {
    title = 'Oda Başkanı';
  }

  // ★ 2. دمج العدد مع العنوان لضمان ظهوره في الإشعار المرئي ★
  if (count > 1) {
    title = `${title} 💬 (${count} Yeni Mesaj)`;
  }

  const options = {
    body    : body,
    icon    : data.icon || 'https://up6.cc/2026/04/177712738518231.png',
    badge   : data.badge || 'https://up6.cc/2026/04/177712738518231.png',
    tag     : 'wow-chat', 
    renotify: true,       
    vibrate : [300, 100, 300],
    data    : {
      url    : data.url || './',
      roomId : data.roomId || null
    }
  };

  const promises = [];

  // إظهار الإشعار المرئي
  promises.push(self.registration.showNotification(title, options));

  // تحديث الرقم الأحمر على أيقونة التطبيق (للتطبيقات المثبتة PWA)
  if ('setAppBadge' in navigator) {
    promises.push(navigator.setAppBadge(count));
  }

  // ★ 3. إرسال أمر فوري للتطبيق المفتوح لتحديث العداد الداخلي ★
  promises.push(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: 'UPDATE_UI_COUNTER', count: count });
      });
    })
  );

  event.waitUntil(Promise.all(promises).catch(console.error));
});


self.addEventListener('notificationclick', event => {
  event.notification.close();

  // ★ تصفير الرقم عند النقر على الإشعار ★
  if ('clearAppBadge' in navigator) {
    navigator.clearAppBadge().catch(() => {});
  }

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
