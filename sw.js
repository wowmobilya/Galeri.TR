/* ============================================================
   WOW MOBİLYA — Service Worker v14
   ⚠️ غيّر VERSION عند كل تحديث لـ index.html
============================================================ */
const VERSION    = 'v17';
const CACHE_NAME = `wow-mobilya-${VERSION}`;
const CORE_ASSETS = ['./', './index.html'];

/* ─── Install ───────────────────────────────────────────── */
self.addEventListener('install', event => {
  console.log('[SW] Installing version:', VERSION);
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(CORE_ASSETS).catch(() => {})
    )
  );
});

/* ─── Activate ──────────────────────────────────────────── */
self.addEventListener('activate', event => {
  console.log('[SW] Activating version:', VERSION);
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ─── Fetch: Network First ──────────────────────────────── */
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('supabase.co')) return;

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

/* ─── Message ───────────────────────────────────────────── */
self.addEventListener('message', event => {

  /* تحديث SW */
  if (event.data === 'SKIP_WAITING') {
    console.log('[SW] Skip waiting triggered');
    self.skipWaiting();
  }

  /* إرجاع الإصدار */
  if (event.data === 'GET_VERSION') {
    event.source.postMessage({ type: 'VERSION', version: VERSION });
  }

  /* ★ إشعار طلب جديد — لـ WOW ★ */
  if (event.data?.type === 'NEW_ORDER_NOTIFY') {
    const d = event.data;
    const icons = { new: '🛒' };
    self.registration.showNotification('🛒 WOW MOBİLYA — Yeni Sipariş!', {
      body            : `👤 ${d.username}\n📋 ${d.orderNum}  ·  📦 ${d.itemCount} ürün`,
      icon            : 'https://up6.cc/2026/04/177695590342861.png',
      badge           : 'https://up6.cc/2026/04/177695590342861.png',
      tag             : 'wow-new-order',
      renotify        : true,
      requireInteraction: true,
      vibrate         : [200, 100, 200, 100, 400],
      data            : {
        url  : self.location.origin + self.location.pathname + '?page=admin',
        type : 'admin'
      },
      actions: [
        { action: 'open',    title: '📋 Siparişi Gör' },
        { action: 'dismiss', title: '✕ Kapat'         },
      ],
    });
  }

  /* ★ إشعار تغيير حالة الطلبية — للمستخدم العادي ★ */
  if (event.data?.type === 'MY_ORDER_STATUS') {
    const d = event.data;
    const statusIcons = {
      manufacturing : '🏭',
      ready         : '🎉',
      cancelled     : '❌',
      pending       : '⏳',
      delivered     : '✅',
    };
    const icon = statusIcons[d.statusKey] || '📋';

    self.registration.showNotification(
      `${icon} Sipariş Durumu: ${d.statusLabel}`,
      {
        body    : `📋 ${d.orderNum}`,
        icon    : 'https://up6.cc/2026/04/177695590342861.png',
        badge   : 'https://up6.cc/2026/04/177695590342861.png',
        tag     : 'my-order-status',
        renotify: true,
        vibrate : [100, 50, 100, 50, 200],
        data    : {
          url  : self.location.origin + self.location.pathname + '?page=myorders',
          type : 'myorders'
        },
      }
    );
  }
});

/* ─── Push (مستقبلاً من خادم) ───────────────────────────── */
self.addEventListener('push', event => {
  let data = { type: 'new_order', username: 'Müşteri', orderNum: '—', itemCount: 0 };
  try { data = event.data?.json() || data; } catch {}

  event.waitUntil(
    self.registration.showNotification('🛒 WOW MOBİLYA', {
      body   : `👤 ${data.username}  ·  📋 ${data.orderNum}`,
      icon   : 'https://up6.cc/2026/04/177695590342861.png',
      badge  : 'https://up6.cc/2026/04/177695590342861.png',
      tag    : 'wow-push',
      renotify: true,
      requireInteraction: true,
      vibrate: [200, 100, 200],
      data   : { url: self.location.origin + self.location.pathname },
    })
  );
});

/* ─── Notification Click ────────────────────────────────── */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url
    || self.location.origin + self.location.pathname;
  const pageType  = event.notification.data?.type || 'admin';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(list => {
        /* إذا كان التطبيق مفتوحاً → focus + إرسال رسالة */
        for (const client of list) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            client.postMessage({ type: 'OPEN_PAGE', page: pageType });
            return;
          }
        }
        /* مغلق → افتح نافذة جديدة */
        if (clients.openWindow) return clients.openWindow(targetUrl);
      })
  );
});
