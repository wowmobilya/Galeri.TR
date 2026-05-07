/* ============================================================
   WOW MOBİLYA — Service Worker v19
   ⚠️ غيّر VERSION عند كل تحديث لـ index.html
============================================================ */
const VERSION    = 'v19';
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

  /* ── تخطي الانتظار ── */
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  /* ── إرجاع الإصدار ── */
  if (event.data === 'GET_VERSION') {
    event.source?.postMessage({ type: 'VERSION', version: VERSION });
    return;
  }

  /* ════════════════════════════════════════════
     ★ طلب جديد — إشعار لـ WOW (الأدمن) ★
  ════════════════════════════════════════════ */
  if (event.data?.type === 'NEW_ORDER_NOTIFY') {
    const d = event.data;

    event.waitUntil(
      self.registration.showNotification(
        '🛒 WOW MOBİLYA — Yeni Sipariş!',
        {
          body              : `👤 ${d.username}\n📋 ${d.orderNum}  ·  📦 ${d.itemCount} ürün`,
          icon              : 'https://up6.cc/2026/04/177695590342861.png',
          badge             : 'https://up6.cc/2026/04/177695590342861.png',
          tag               : 'wow-new-order',
          renotify          : true,
          requireInteraction: true,
          vibrate           : [200, 100, 200, 100, 400],
          silent            : false,
          data              : {
            url : self.location.origin + self.location.pathname + '?page=admin',
            page: 'admin',
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

  /* ════════════════════════════════════════════
     ★ تغيير حالة الطلبية — إشعار للمستخدم ★
  ════════════════════════════════════════════ */
  if (event.data?.type === 'MY_ORDER_STATUS') {
    const d = event.data;

    const icons = {
      manufacturing : '🏭',
      ready         : '🎉',
      cancelled     : '❌',
      pending       : '⏳',
      delivered     : '✅',
    };
    const icon = icons[d.statusKey] || '📋';

    event.waitUntil(
      self.registration.showNotification(
        `${icon} Sipariş Durumu Güncellendi`,
        {
          body    : `${d.statusLabel}\n📋 ${d.orderNum}`,
          icon    : 'https://up6.cc/2026/04/177695590342861.png',
          badge   : 'https://up6.cc/2026/04/177695590342861.png',
          tag     : 'my-order-status-' + (d.orderNum || Date.now()),
          renotify: true,
          silent  : false,
          vibrate : [100, 50, 100, 50, 200],
          data    : {
            url : self.location.origin + self.location.pathname + '?page=myorders',
            page: 'myorders',
          },
        }
      )
    );
    return;
  }

  /* ════════════════════════════════════════════
     ★ Push عام — احتياطي ★
  ════════════════════════════════════════════ */
  if (event.data?.type === 'PUSH_NOTIFY') {
    const d = event.data;
    event.waitUntil(
      self.registration.showNotification(
        d.title || 'WOW MOBİLYA',
        {
          body    : d.body || '',
          icon    : 'https://up6.cc/2026/04/177695590342861.png',
          badge   : 'https://up6.cc/2026/04/177695590342861.png',
          tag     : d.tag || 'wow-general',
          renotify: true,
          vibrate : [150, 100, 150],
          data    : { url: self.location.origin + self.location.pathname, page: d.page || '' },
        }
      )
    );
    return;
  }
});

/* ─── Push (من خادم VAPID) ──────────────────────────────── */
self.addEventListener('push', event => {
  let data = {
    title    : '🛒 WOW MOBİLYA',
    body     : 'Yeni bildirim var!',
    page     : 'admin',
    orderNum : '',
  };

  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch(e) {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body              : data.body,
      icon              : 'https://up6.cc/2026/04/177695590342861.png',
      badge             : 'https://up6.cc/2026/04/177695590342861.png',
      tag               : 'wow-push-' + (data.orderNum || Date.now()),
      renotify          : true,
      requireInteraction: true,
      silent            : false,
      vibrate           : [200, 100, 200, 100, 400],
      data              : {
        url : self.location.origin + self.location.pathname + '?page=' + data.page,
        page: data.page,
      },
      actions: [
        { action: 'open',    title: '📋 Görüntüle' },
        { action: 'dismiss', title: '✕ Kapat'      },
      ],
    })
  );
});

/* ─── Notification Click ────────────────────────────────── */
self.addEventListener('notificationclick', event => {
  event.notification.close();

  /* زر الإغلاق → لا تفعل شيئاً */
  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url
    || (self.location.origin + self.location.pathname);
  const page = event.notification.data?.page || 'admin';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(list => {

        /* ── التطبيق مفتوح في تبويب → نشّطه وأرسل رسالة ── */
        for (const client of list) {
          if (
            client.url.includes(self.location.origin) &&
            'focus' in client
          ) {
            client.focus();
            client.postMessage({ type: 'OPEN_PAGE', page });
            return;
          }
        }

        /* ── التطبيق مغلق → افتح نافذة جديدة ── */
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

/* ─── Notification Close ────────────────────────────────── */
self.addEventListener('notificationclose', event => {
  /* يمكن تتبع الإغلاق هنا إذا احتجت */
  console.log('[SW] Notification closed:', event.notification.tag);
});
