/* ============================================================
   PWA — نظام التحديث الفوري
============================================================ */
const APP_VERSION = 'v4';   // ← نفس رقم VERSION في sw.js

let deferredPrompt    = null;
let swRegistration    = null;
let updateToastShown  = false;

/* ── تسجيل Service Worker ── */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      swRegistration = await navigator.serviceWorker.register('./sw.js');
      console.log('[PWA] SW registered:', swRegistration.scope);

      /* فحص التحديثات كل 60 ثانية */
      setInterval(() => {
        swRegistration.update().catch(() => {});
      }, 60_000);

      /* SW جديد في انتظار التفعيل */
      swRegistration.addEventListener('updatefound', () => {
        const newWorker = swRegistration.installing;
        newWorker.addEventListener('statechange', () => {
          if (
            newWorker.state === 'installed' &&
            navigator.serviceWorker.controller
          ) {
            showUpdateToast();
          }
        });
      });

      /* إذا كان SW جديد موجوداً مسبقاً عند التحميل */
      if (swRegistration.waiting && navigator.serviceWorker.controller) {
        showUpdateToast();
      }

    } catch (err) {
      console.warn('[PWA] SW registration failed:', err);
    }
  });

  /* تطبيق التحديث وإعادة التحميل */
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!updateToastShown) return;
    window.location.reload();
  });
}

/* ── إشعار التحديث ── */
function showUpdateToast() {
  if (updateToastShown) return;
  updateToastShown = true;

  // إزالة أي إشعار قديم
  document.getElementById('updateToast')?.remove();

  const toast = document.createElement('div');
  toast.id = 'updateToast';
  toast.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0;">
      <div style="
        width:36px;height:36px;flex-shrink:0;
        background:linear-gradient(135deg,rgba(201,168,76,0.2),rgba(201,168,76,0.06));
        border:1px solid rgba(201,168,76,0.35);border-radius:10px;
        display:flex;align-items:center;justify-content:center;
        color:#c9a84c;font-size:16px;">
        <i class='fas fa-sync-alt'></i>
      </div>
      <div style="min-width:0;">
        <div style="font-size:12px;font-weight:700;color:#fff;letter-spacing:0.5px;">
          Güncelleme Mevcut
        </div>
        <div style="font-size:10px;color:rgba(255,255,255,0.4);margin-top:2px;letter-spacing:1px;">
          Yeni içerik hazır
        </div>
      </div>
    </div>
    <div style="display:flex;gap:7px;flex-shrink:0;">
      <button onclick="applyUpdate()" style="
        padding:8px 16px;border-radius:8px;border:none;cursor:pointer;
        background:linear-gradient(135deg,#c9a84c,#f0d080);
        color:#0a0a0a;font-weight:700;font-size:11px;
        font-family:'Montserrat',sans-serif;letter-spacing:1px;
        transition:all 0.2s;white-space:nowrap;">
        <i class='fas fa-sync-alt'></i> GÜNCELLE
      </button>
      <button onclick="dismissUpdateToast()" style="
        padding:8px 10px;border-radius:8px;cursor:pointer;
        background:rgba(255,255,255,0.05);
        border:1px solid rgba(255,255,255,0.1);
        color:rgba(255,255,255,0.4);font-size:13px;
        transition:all 0.2s;">
        <i class='fas fa-times'></i>
      </button>
    </div>
  `;

  toast.style.cssText = `
    position: fixed;
    bottom: 28px;
    left: 50%;
    transform: translateX(-50%) translateY(120px);
    background: rgba(10,10,10,0.97);
    border: 1px solid rgba(201,168,76,0.35);
    border-radius: 16px;
    padding: 12px 14px;
    display: flex;
    align-items: center;
    gap: 12px;
    z-index: 99999;
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    box-shadow: 0 12px 50px rgba(0,0,0,0.7), 0 0 0 1px rgba(201,168,76,0.1);
    width: min(420px, 92vw);
    font-family: 'Montserrat', sans-serif;
    transition: transform 0.45s cubic-bezier(0.34,1.56,0.64,1);
  `;

  document.body.appendChild(toast);

  // تحريك الإشعار للأعلى
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.style.transform = 'translateX(-50%) translateY(0)';
    });
  });

  // إخفاء تلقائي بعد 15 ثانية
  setTimeout(dismissUpdateToast, 15_000);
}

function dismissUpdateToast() {
  const toast = document.getElementById('updateToast');
  if (!toast) return;
  toast.style.transform = 'translateX(-50%) translateY(120px)';
  setTimeout(() => toast.remove(), 450);
}

function applyUpdate() {
  dismissUpdateToast();
  if (swRegistration?.waiting) {
    swRegistration.waiting.postMessage('SKIP_WAITING');
  } else {
    window.location.reload();
  }
}

/* ── زر التثبيت ── */
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallBtn();
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  hideInstallBtn();
});

function showInstallBtn() {
  if (document.getElementById('installPwaBtn')) return;

  const btn = document.createElement('button');
  btn.id        = 'installPwaBtn';
  btn.className = 'nav-icon-btn';
  btn.setAttribute('data-tip', 'Uygulamayı Yükle');
  btn.innerHTML = '<i class="fas fa-download"></i>';
  btn.style.cssText = `
    background: linear-gradient(135deg,rgba(201,168,76,0.18),rgba(201,168,76,0.06));
    border-color: rgba(201,168,76,0.4);
    color: var(--gold);
    animation: iconPulse 2.2s infinite;
  `;
  btn.onclick = triggerInstall;
  document.querySelector('.nav-tools')?.prepend(btn);

  const mobBtn = document.createElement('button');
  mobBtn.id        = 'installPwaMobBtn';
  mobBtn.className = 'mob-home-btn';
  mobBtn.style.cssText = `
    background:linear-gradient(135deg,rgba(201,168,76,0.15),rgba(201,168,76,0.05));
    border-color:rgba(201,168,76,0.35);
    animation:iconPulse 2.2s infinite;
  `;
  mobBtn.innerHTML = '<i class="fas fa-download"></i> UYGULAMAYI YÜKLE';
  mobBtn.onclick   = () => { triggerInstall(); closeMobileMenu(); };
  const mobMenu = document.querySelector('.mobile-menu-inner');
  if (mobMenu) mobMenu.insertBefore(mobBtn, mobMenu.firstChild);
}

function hideInstallBtn() {
  ['installPwaBtn','installPwaMobBtn'].forEach(id =>
    document.getElementById(id)?.remove()
  );
}

function triggerInstall() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(choice => {
    deferredPrompt = null;
    hideInstallBtn();
  });
}
