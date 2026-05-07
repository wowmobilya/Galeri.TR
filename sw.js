/* ============================================================
   WOW MOBİLYA — Service Worker v14
   ⚠️ غيّر VERSION عند كل تحديث لـ index.html
============================================================ */
const VERSION    = 'v14';
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

  /* ── تحديث SW ── */
  if (event.data === 'SKIP_WAITING') {
    console.log('[SW] Skip waiting triggered');
    self.skipWaiting();
    return;
  }

  if (event.data === 'GET_VERSION') {
    event.source?.postMessage({ type: 'VERSION', version: VERSION });
    return;
  }

  /* ══════════════════════════════════════════════════════
     ★ WOW — إشعار طلب جديد
  ══════════════════════════════════════════════════════ */
  if (event.data?.type === 'NEW_ORDER_NOTIFY') {
    const d = event.data;
    self.registration.showNotification('🛒 WOW MOBİLYA — Yeni Sipariş!', {
      body             : `👤 ${d.username}\n📋 ${d.orderNum}  ·  📦 ${d.itemCount} ürün`,
      icon             : 'https://up6.cc/2026/04/177695590342861.png',
      badge            : 'https://up6.cc/2026/04/177695590342861.png',
      tag              : 'wow-new-order',
      renotify         : true,
      requireInteraction: true,
      vibrate          : [200, 100, 200, 100, 400],
      data             : {
        url  : self.location.origin + self.location.pathname,
        page : 'admin',
      },
      actions: [
        { action: 'open',    title: '📋 Siparişi Gör' },
        { action: 'dismiss', title: '✕ Kapat'         },
      ],
    });
    return;
  }

  /* ══════════════════════════════════════════════════════
     ★ المستخدم العادي — تغيير حالة طلبيته
  ══════════════════════════════════════════════════════ */
  if (event.data?.type === 'MY_ORDER_STATUS') {
    const d = event.data;

    const config = {
      manufacturing: { emoji:'🏭', title:'Siparişiniz Üretime Alındı',  vibrate:[100,50,100]           },
      ready        : { emoji:'🎉', title:'Siparişiniz Teslime Hazır!',   vibrate:[200,100,200,100,200]  },
      cancelled    : { emoji:'❌', title:'Siparişiniz İptal Edildi',      vibrate:[300,100,300]          },
      pending      : { emoji:'⏳', title:'Siparişiniz Beklemeye Alındı', vibrate:[100]                  },
    };

    const cfg = config[d.statusKey] || {
      emoji:'📋', title:'Sipariş Durumu Güncellendi', vibrate:[100]
    };

    self.registration.showNotification(
      `${cfg.emoji} ${cfg.title}`,
      {
        body             : `📋 ${d.orderNum}`,
        icon             : 'https://up6.cc/2026/04/177695590342861.png',
        badge            : 'https://up6.cc/2026/04/177695590342861.png',
        tag              : 'my-order-status',
        renotify         : true,
        requireInteraction: d.statusKey === 'ready',
        vibrate          : cfg.vibrate,
        data             : {
          url  : self.location.origin + self.location.pathname,
          page : 'myorders',
        },
      }
    );
    return;
  }
});

/* ─── Push (من خادم خارجي مستقبلاً) ────────────────────── */
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data?.json() || {}; } catch {}

  const isAdmin = data.type === 'NEW_ORDER_NOTIFY';

  const title = isAdmin
    ? '🛒 WOW MOBİLYA — Yeni Sipariş!'
    : `📋 Sipariş Durumu: ${data.statusLabel || ''}`;

  const body = isAdmin
    ? `👤 ${data.username || '—'}\n📋 ${data.orderNum || '—'}  ·  📦 ${data.itemCount || 0} ürün`
    : `📋 ${data.orderNum || '—'}`;

  event.waitUntil(
    self.registration.showNotification(title, {
      body             : body,
      icon             : 'https://up6.cc/2026/04/177695590342861.png',
      badge            : 'https://up6.cc/2026/04/177695590342861.png',
      tag              : isAdmin ? 'wow-new-order' : 'my-order-status',
      renotify         : true,
      requireInteraction: isAdmin,
      vibrate          : isAdmin ? [200,100,200,100,400] : [100,50,100],
      data             : {
        url  : self.location.origin + self.location.pathname,
        page : isAdmin ? 'admin' : 'myorders',
      },
    })
  );
});

/* ─── NotificationClick ─────────────────────────────────── */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const targetPage = event.notification.data?.page || '';
  const targetUrl  = event.notification.data?.url  || self.location.origin;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(list => {
        /* إذا التطبيق مفتوح → focus + أرسل رسالة */
        for (const client of list) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            client.postMessage({
              type : 'OPEN_PAGE',
              page : targetPage,
            });
            return;
          }
        }
        /* مغلق → افتح نافذة جديدة */
        if (clients.openWindow) {
          return clients.openWindow(targetUrl + '?page=' + targetPage);
        }
      })
  );
});

/* ─── NotificationClose ─────────────────────────────────── */
self.addEventListener('notificationclose', event => {
  console.log('[SW] Notification closed:', event.notification.tag);
});
