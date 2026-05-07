/* ============================================================
   WOW MOBİLYA — Service Worker v15
   ⚠️ غيّر VERSION عند كل تحديث لـ index.html
============================================================ */
const VERSION    = 'v15';
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
    return;
  }

  /* إرجاع الإصدار */
  if (event.data === 'GET_VERSION') {
    event.source?.postMessage({ type: 'VERSION', version: VERSION });
    return;
  }

  /* ★ إشعار طلب جديد — لـ WOW فقط ★ */
  if (event.data?.type === 'NEW_ORDER_NOTIFY') {
    const d = event.data;
    event.waitUntil(
      self.registration.showNotification('🛒 WOW MOBİLYA — Yeni Sipariş!', {
        body             : `👤 ${d.username}\n📋 ${d.orderNum}  ·  📦 ${d.itemCount} ürün`,
        icon             : 'https://up6.cc/2026/04/177695590342861.png',
        badge            : 'https://up6.cc/2026/04/177695590342861.png',
        tag              : 'wow-new-order',
        renotify         : true,
        requireInteraction: true,
        vibrate          : [200, 100, 200, 100, 400],
        data             : {
          url  : self.location.origin + self.location.pathname + '?page=admin',
          type : 'new-order',
        },
        actions: [
          { action: 'open',    title: '📋 Siparişi Gör' },
          { action: 'dismiss', title: '✕ Kapat'         },
        ],
      })
    );
    return;
  }

  /* ★ إشعار تغيير حالة الطلبية — للمستخدم العادي ★ */
  if (event.data?.type === 'MY_ORDER_STATUS') {
    const d = event.data;

    const iconMap = {
      manufacturing : '🏭',
      ready         : '🎉',
      cancelled     : '❌',
      pending       : '⏳',
    };
    const icon = iconMap[d.statusKey] || '📋';

    const bodyMap = {
      manufacturing : 'Siparişiniz üretime alındı',
      ready         : 'Siparişiniz teslime hazır!',
      cancelled     : 'Siparişiniz iptal edildi',
      pending       : 'Siparişiniz beklemeye alındı',
    };
    const body = bodyMap[d.statusKey] || 'Sipariş durumu güncellendi';

    event.waitUntil(
      self.registration.showNotification(
        `${icon} ${body}`,
        {
          body    : `📋 ${d.orderNum}`,
          icon    : 'https://up6.cc/2026/04/177695590342861.png',
          badge   : 'https://up6.cc/2026/04/177695590342861.png',
          tag     : 'my-order-status',
          renotify: true,
          vibrate : [100, 50, 200],
          data    : {
            url  : self.location.origin + self.location.pathname + '?page=myorders',
            type : 'order-status',
          },
        }
      )
    );
    return;
  }
});

/* ─── Push (مستقبلاً من الخادم) ────────────────────────── */
self.addEventListener('push', event => {
  let data = { type: 'new-order', username: 'Müşteri', orderNum: '—', itemCount: 0 };
  try { data = event.data?.json() || data; } catch {}

  const isNewOrder = data.type === 'new-order';

  event.waitUntil(
    self.registration.showNotification(
      isNewOrder ? '🛒 WOW MOBİLYA — Yeni Sipariş!' : '📋 Sipariş Durumu Güncellendi',
      {
        body             : isNewOrder
          ? `👤 ${data.username}\n📋 ${data.orderNum}  ·  📦 ${data.itemCount} ürün`
          : `📋 ${data.orderNum}`,
        icon             : 'https://up6.cc/2026/04/177695590342861.png',
        badge            : 'https://up6.cc/2026/04/177695590342861.png',
        tag              : isNewOrder ? 'wow-new-order' : 'my-order-status',
        renotify         : true,
        requireInteraction: isNewOrder,
        vibrate          : isNewOrder ? [200, 100, 200, 100, 400] : [100, 50, 200],
        data             : {
          url  : self.location.origin + self.location.pathname +
                 (isNewOrder ? '?page=admin' : '?page=myorders'),
          type : data.type,
        },
        actions: isNewOrder ? [
          { action: 'open',    title: '📋 Siparişi Gör' },
          { action: 'dismiss', title: '✕ Kapat'         },
        ] : [],
      }
    )
  );
});

/* ─── Notification Click ────────────────────────────────── */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url
    || self.location.origin + self.location.pathname;
  const notifType = event.notification.data?.type || 'new-order';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(list => {
        /* إذا التطبيق مفتوح → focus وأرسل رسالة */
        for (const client of list) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            client.postMessage({
              type : notifType === 'new-order' ? 'OPEN_ADMIN_PAGE' : 'OPEN_MY_ORDERS',
            });
            return;
          }
        }
        /* مغلق → افتح نافذة جديدة */
        if (clients.openWindow) return clients.openWindow(targetUrl);
      })
  );
});
