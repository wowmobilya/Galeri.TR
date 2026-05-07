/* ============================================================
   WOW MOBİLYA — Service Worker v18
   ⚠️ غيّر VERSION عند كل تحديث لـ index.html
============================================================ */
const VERSION    = 'v18';
const CACHE_NAME = `wow-mobilya-${VERSION}`;
const CORE_ASSETS = ['./', './index.html'];

/* ─── Install ───────────────────────────────────────────── */
self.addEventListener('install', event => {
  console.log('[SW] Installing:', VERSION);
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(c =>
      c.addAll(CORE_ASSETS).catch(() => {})
    )
  );
});

/* ─── Activate ──────────────────────────────────────────── */
self.addEventListener('activate', event => {
  console.log('[SW] Activating:', VERSION);
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ─── Fetch ─────────────────────────────────────────────── */
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('supabase.co')) return;

  event.respondWith(
    fetch(event.request, { cache: 'no-cache' })
      .then(res => {
        if (res.ok) {
          caches.open(CACHE_NAME)
            .then(c => c.put(event.request, res.clone()));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

/* ─── Message ───────────────────────────────────────────── */
self.addEventListener('message', event => {

  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (event.data === 'GET_VERSION') {
    event.source?.postMessage({ type: 'VERSION', version: VERSION });
    return;
  }

  /* ★ طلب جديد — لـ WOW ★ */
  if (event.data?.type === 'NEW_ORDER_NOTIFY') {
    const d = event.data;
    event.waitUntil(
      self.registration.showNotification(
        '🛒 WOW MOBİLYA — Yeni Sipariş!',
        {
          body             : `👤 ${d.username}\n📋 ${d.orderNum}  ·  📦 ${d.itemCount} ürün`,
          icon             : 'https://up6.cc/2026/04/177695590342861.png',
          badge            : 'https://up6.cc/2026/04/177695590342861.png',
          tag              : 'wow-new-order',
          renotify         : true,
          requireInteraction: true,
          vibrate          : [200, 100, 200, 100, 400],
          data             : {
            url : self.location.origin + self.location.pathname + '?page=admin',
            page: 'admin'
          },
          actions: [
            { action: 'open',    title: '📋 Siparişi Gör' },
            { action: 'dismiss', title: '✕ Kapat'         },
          ],
        }
      )
    );
    return;
  }

  /* ★ تغيير حالة الطلبية — للمستخدم العادي ★ */
  if (event.data?.type === 'MY_ORDER_STATUS') {
    const d = event.data;
    const icons = {
      manufacturing: '🏭', ready: '🎉',
      cancelled: '❌', pending: '⏳', delivered: '✅'
    };
    const icon = icons[d.statusKey] || '📋';

    event.waitUntil(
      self.registration.showNotification(
        `${icon} Sipariş Durumu Güncellendi`,
        {
          body    : `${d.statusLabel}\n📋 ${d.orderNum}`,
          icon    : 'https://up6.cc/2026/04/177695590342861.png',
          badge   : 'https://up6.cc/2026/04/177695590342861.png',
          tag     : 'my-order-status',
          renotify: true,
          vibrate : [100, 50, 100, 50, 200],
          data    : {
            url : self.location.origin + self.location.pathname + '?page=myorders',
            page: 'myorders'
          },
        }
      )
    );
    return;
  }
});

/* ─── Notification Click ────────────────────────────────── */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url
    || (self.location.origin + self.location.pathname);
  const page = event.notification.data?.page || 'admin';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(list => {
        /* التطبيق مفتوح → focus + فتح الصفحة */
        for (const client of list) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            client.postMessage({ type: 'OPEN_PAGE', page });
            return;
          }
        }
        /* مغلق → افتح */
        if (clients.openWindow) return clients.openWindow(targetUrl);
      })
  );
});
