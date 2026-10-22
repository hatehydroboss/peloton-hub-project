/* =============================================
   PelotonHub — main.js  (Firebase edition)
   Shared UI utilities + Firebase Auth state
   for the storefront. Loaded as type="module"
   on every customer-facing HTML page.
   Also builds the mobile app shell (bottom tab
   bar) and the motion layer used with app.css.
   ============================================= */

import {
  auth,
  onAuthStateChanged,
} from './firebase.js';
import { apiCartGet, apiLogout, apiMe, apiLogin, apiSettingsGet, apiSocialLogin } from './firebase.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Loading screen (page-loader.js): a script that fills the page takes a hold and calls the
// returned function once its content is on screen; the screen lifts when all are released.
function holdLoader() { return window.phLoaderHold ? window.phLoaderHold() : () => {}; }
const releaseAuthHold = holdLoader();   // navbar/tab bar show the right Sign In / name first

// ── UTILS ──────────────────────────────────────
function qs(sel, ctx)  { return (ctx || document).querySelector(sel); }
function qsa(sel, ctx) { return [...(ctx || document).querySelectorAll(sel)]; }
function esc(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, ch => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
  }[ch]));
}
function peso(n) { return '₱' + Math.round(n).toLocaleString('en-PH'); }

// ── TOAST ──────────────────────────────────────
const Toast = {
  show(msg) {
    let el = document.getElementById('ph-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ph-toast';
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 3000);
  }
};

// ── NAV TOGGLE (mobile) ─────────────────────────
function initNav() {
  const toggle = qs('#nav-toggle');
  const links  = qs('#nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', (e) => {
      if (links.classList.contains('open') &&
          !links.contains(e.target) && e.target !== toggle) {
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Highlight the current nav link
  const page = location.pathname.split('/').pop() || 'index.html';
  qsa('.nav-links a').forEach(a => {
    const href = a.getAttribute('href') || '';
    if (href && href.split('?')[0].split('/').pop() === page) {
      a.setAttribute('aria-current', 'page');
    }
  });
}

// ── MOBILE TAB BAR ──────────────────────────────
// Phones (and the APK) navigate with a bottom tab bar instead of the ☰ menu.
const TABS = [
  { href: 'home.html',    ico: 'home', label: 'Home',    match: ['home.html', 'index.html', ''] },
  { href: 'catalog.html', ico: 'bike', label: 'Shop',    match: ['catalog.html', 'product.html'] },
  { href: 'events.html',  ico: 'calendar', label: 'Events',  match: ['events.html'] },
  { href: 'cart.html',    ico: 'cart', label: 'Cart',    match: ['cart.html'], cart: true },
  { href: 'profile.html', ico: 'user', label: 'Account', match: ['profile.html', 'orders.html', 'auth.html'] },
];
function injectTabbar() {
  if (!qs('.navbar') || qs('.app-tabbar')) return;
  const page = location.pathname.split('/').pop() || 'index.html';
  const bar  = document.createElement('nav');
  bar.className = 'app-tabbar';
  bar.setAttribute('aria-label', 'App navigation');
  bar.innerHTML = TABS.map(t => `
    <a href="${t.href}" data-tab="${t.label.toLowerCase()}" class="${t.match.includes(page) ? 'active' : ''}${t.cart ? ' tabbar-cart' : ''}"${t.match.includes(page) ? ' aria-current="page"' : ''}>
      <span class="tab-ico" aria-hidden="true">${icon(t.ico)}${t.cart ? '<span class="badge" hidden>0</span>' : ''}</span>
      <span>${t.label}</span>
    </a>`).join('');
  document.body.appendChild(bar);
}

// ── BACK BUTTON (top-left, every page except Home) ──
// Only in the Android app: on the website (PC or phone browser) the browser
// already has its own Back button.
// Goes back in history when the previous page is ours; otherwise (app just
// opened on this page, or came from sign-in) goes to the page's parent.
const BACK_FALLBACK = { 'product.html': 'catalog.html', 'orders.html': 'profile.html' };
const NO_BACK       = ['home.html', 'index.html', ''];
const isApp = () => !!window.Capacitor?.isNativePlatform?.();
function injectBackButton() {
  const nav  = qs('.navbar');
  const page = location.pathname.split('/').pop() || 'index.html';
  if (!isApp() || !nav || NO_BACK.includes(page) || qs('.nav-back')) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'nav-back';
  btn.setAttribute('aria-label', 'Go back');
  btn.innerHTML = icon('arrow-left');
  btn.addEventListener('click', goBack);
  nav.prepend(btn);
  nav.classList.add('has-back');
}

function goBack() {
  const page = location.pathname.split('/').pop() || 'index.html';
  let fromUs = false;
  try {
    const ref = new URL(document.referrer);
    const refPage = ref.pathname.split('/').pop();
    fromUs = ref.origin === location.origin && !['auth.html', 'index.html', ''].includes(refPage);
  } catch {}
  // history.state is set by in-page steps (e.g. cart checkout) that pushState
  if (history.length > 1 && (fromUs || history.state)) history.back();
  else location.href = BACK_FALLBACK[page] || 'home.html';
}

// Android back button (the APK's MainActivity calls this). Closes an open
// sheet/dialog first, then behaves like the top-left back button.
// Returns 'exit' on Home so the app closes from there.
window.phHandleBack = function () {
  const filter = qs('.filter-panel.open');
  if (filter) { qs('#filter-backdrop')?.click(); return 'handled'; }
  const dropdown = qs('.fsel.open');
  if (dropdown) { dropdown.querySelector('.fsel-btn').click(); return 'handled'; }
  if (qs('.si-overlay.open') || qs('.modal-overlay.open')) {   // sign-in sheet or a page dialog (they close on Escape)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return 'handled';
  }
  const page = location.pathname.split('/').pop() || 'index.html';
  if (NO_BACK.includes(page)) return 'exit';
  goBack();
  return 'handled';
};

// ── PULL TO REFRESH ─────────────────────────────
// Drag down while at the very top of the page to reload it.
function initPullToRefresh() {
  if (!('ontouchstart' in window)) return;
  const ind = document.createElement('div');
  ind.className = 'ptr';
  ind.setAttribute('aria-hidden', 'true');
  ind.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v5h-5"/></svg>';
  document.body.appendChild(ind);
  const svg = ind.firstChild;
  const TRIGGER = 70, MAX = 110;
  let startY = null, dist = 0, busy = false;

  const set = (d, anim) => {
    ind.style.transition = anim ? 'transform .25s ease, opacity .2s' : 'opacity .2s';
    ind.style.transform = `translateY(${d - 50}px)`;
    ind.style.opacity = d > 8 ? Math.min(1, d / TRIGGER) : 0;
    if (!busy) svg.style.transform = `rotate(${d * 3}deg)`;
  };
  document.addEventListener('touchstart', e => {
    if (busy || e.touches.length !== 1 || window.scrollY > 0) return;
    if (e.target.closest('textarea, select, .filter-panel, .si-overlay, .fsel-list, .app-tabbar')) return;
    if (qs('.filter-panel.open, .si-overlay.open')) return;
    startY = e.touches[0].clientY; dist = 0;
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (startY === null) return;
    const dy = e.touches[0].clientY - startY;
    if (dy <= 0 || window.scrollY > 0) { startY = null; set(0, true); return; }
    dist = Math.min(dy * 0.5, MAX);
    ind.classList.toggle('ready', dist >= TRIGGER);
    set(dist, false);
  }, { passive: true });
  document.addEventListener('touchend', () => {
    if (startY === null) return;
    startY = null;
    if (dist >= TRIGGER) {
      busy = true;
      svg.style.transform = '';
      ind.classList.add('spinning');
      set(TRIGGER, true);
      setTimeout(() => location.reload(), 350);
    } else set(0, true);
  });
}

// ── SHOW FORM MESSAGE ───────────────────────────
function showMsg(el, type, text) {
  if (!el) return;
  el.textContent = text;
  el.className = 'form-msg show ' + type;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 4500);
}

// ── CART BADGES (navbar + tab bar) ──────────────
let lastCount = null;
function setBadges(count) {
  qsa('.navbar .badge, .app-tabbar .badge').forEach(b => {
    b.textContent = count;
    b.hidden = !count;
    if (lastCount !== null && count > lastCount) { b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
  });
  lastCount = count;
}
async function refreshCartBadge() {
  try {
    const data = await apiCartGet();
    const count = data.ok && data.cart ? data.cart.reduce((s, l) => s + (l.qty || 0), 0) : 0;
    setBadges(count);
  } catch {
    setBadges(0);
  }
}

// ── ADD-TO-CART ANIMATION ───────────────────────
// Flies a copy of the product image into the cart icon, then shakes the cart.
function flyToCart(sourceEl) {
  const target = [qs('.app-tabbar .tabbar-cart .tab-ico'), qs('.navbar .icon-btn')]
    .find(el => el && el.getBoundingClientRect().width > 0);
  if (!target) return;
  const shake = () => {
    const holder = target.closest('.tabbar-cart') || target;
    holder.classList.remove('shake'); void holder.offsetWidth; holder.classList.add('shake');
  };
  if (reduceMotion || !sourceEl) { shake(); return; }
  const from = sourceEl.getBoundingClientRect();
  const to   = target.getBoundingClientRect();
  const size = Math.min(from.width, from.height, 140);
  const fly  = sourceEl.tagName === 'IMG' ? sourceEl.cloneNode() : document.createElement('div');
  if (fly.tagName !== 'IMG') { fly.innerHTML = icon('bike'); fly.style.cssText = 'display:grid;place-items:center;font-size:3rem;background:#fff;'; }
  fly.className = 'ph-fly';
  Object.assign(fly.style, { left: `${from.left + from.width / 2 - size / 2}px`, top: `${from.top + from.height / 2 - size / 2}px`, width: `${size}px`, height: `${size}px` });
  document.body.appendChild(fly);
  requestAnimationFrame(() => {
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    fly.style.transform = `translate(${dx}px, ${dy}px) scale(.12) rotate(25deg)`;
    fly.style.opacity = '.4';
  });
  setTimeout(() => { fly.remove(); shake(); }, 760);
}

// ── CONFETTI (reservation confirmed) ────────────
function confetti(count = 70) {
  if (reduceMotion) return;
  const colors = ['#ff4d23', '#ff8a3d', '#c6f92e', '#14100c', '#ffd23f'];
  for (let i = 0; i < count; i++) {
    const c = document.createElement('i');
    c.className = 'ph-confetti';
    c.style.left = Math.random() * 100 + 'vw';
    c.style.background = colors[i % colors.length];
    c.style.animationDuration = 1.6 + Math.random() * 1.6 + 's';
    c.style.animationDelay = Math.random() * .4 + 's';
    c.style.transform = `rotate(${Math.random() * 360}deg)`;
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 3800);
  }
}

// ── SKELETON PLACEHOLDERS ───────────────────────
function skeletonCards(n = 6) {
  return Array.from({ length: n }, () => `
    <div class="skeleton-card p-card" aria-hidden="true">
      <div class="skeleton sk-img"></div>
      <div class="sk-body"><div class="skeleton sk-line w40"></div><div class="skeleton sk-line w70"></div><div class="skeleton sk-line w30"></div></div>
    </div>`).join('');
}

// ── SCROLL REVEAL ───────────────────────────────
// Cards and sections fade up as they enter the screen; content rendered
// later (catalog grid, events…) is picked up by the MutationObserver.
const REVEAL_SEL = '.p-card, .card-link, .cat-card, .tier-card, .stat, .event-row, .section-title, .section-head, .panel, .form-card, .order-summary, .promo-box, .split-2-center > div, .table-wrap, .wishlist-item, .icon-tile, .route-map';
let revealIO = null;
function initReveal() {
  if (reduceMotion || !('IntersectionObserver' in window) || document.visibilityState === 'hidden') return;
  revealIO = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) showEl(en.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  scanReveal(document);
  new MutationObserver(muts => muts.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) scanReveal(n); })))
    .observe(document.body, { childList: true, subtree: true });
}
function scanReveal(root) {
  const els = [...(root.matches?.(REVEAL_SEL) ? [root] : []), ...qsa(REVEAL_SEL, root)];
  const groups = new Map();
  els.forEach(el => {
    if (el.classList.contains('reveal') || el.closest('.app-tabbar, .filter-panel, .modal-overlay, .si-overlay, .skeleton-card')) return;
    // Stagger siblings in the same grid
    const k = el.parentElement; const i = groups.get(k) || 0; groups.set(k, i + 1);
    el.style.setProperty('--i', Math.min(i, 8));
    el.classList.add('reveal');
    qsa('.progress-fill', el).forEach(f => { if (!f.dataset.w) { f.dataset.w = f.style.width; f.style.width = '0'; } });
    // Already on screen: show now (with the stagger). Below the fold: wait for scroll.
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) { setTimeout(() => showEl(el), 30); return; }
    revealIO.observe(el);
    // Safety net: never leave content invisible if the observer is paused (background tab, some WebViews)
    setTimeout(() => showEl(el), 4000);
  });
}
function showEl(el) {
  if (el.classList.contains('is-in')) return;
  el.classList.add('is-in');
  qsa('.progress-fill[data-w]', el).forEach(f => { f.style.width = f.dataset.w; });
  revealIO.unobserve(el);
}

// ── PAGE TRANSITIONS ────────────────────────────
// A short fade-out before following internal links makes page changes feel app-like.
function initPageTransitions() {
  if (reduceMotion) return;
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || a.target === '_blank' || a.hasAttribute('download') || /^(mailto|tel|javascript):/.test(href)) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
    e.preventDefault();
    document.body.classList.add('page-leave');
    window.phLoaderShow?.();
    setTimeout(() => { location.href = a.href; }, 90);
  });
  // Coming back via the browser/Android back button restores the page from cache
  window.addEventListener('pageshow', ev => { if (ev.persisted) document.body.classList.remove('page-leave'); });
  // Pull-to-refresh and other reloads
  window.addEventListener('beforeunload', () => window.phLoaderShow?.());
}

// ── PRODUCT CARD (catalog, home) ────────────────
// Custom icon from img/icons.svg (made for PelotonHub)
function icon(name, extra = '') {
  return `<svg class="picon${extra ? ' ' + extra : ''}" aria-hidden="true"><use href="img/icons.svg#i-${name}"/></svg>`;
}

function productCard(p) {
  const off  = p.old_price && p.old_price > p.price ? Math.round((1 - p.price / p.old_price) * 100) : 0;
  const tag  = p.tag ? `<span class="p-badge ${esc(p.tag)}">${esc(p.tag)}</span>` : '';
  const low  = p.in_stock && p.stock_qty != null && p.stock_qty > 0 && p.stock_qty <= 5;
  return `
    <a href="product.html?id=${encodeURIComponent(p.id)}" class="p-card${p.in_stock ? '' : ' is-out'}">
      <div class="p-media">
        ${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" />` : `<span class="p-emoji" aria-hidden="true">${icon('bike')}</span>`}
        <div class="p-badges">${tag}${off ? `<span class="p-badge off">-${off}%</span>` : ''}</div>
        ${p.in_stock ? '' : '<span class="p-flag soldout">Sold out</span>'}
        ${low ? `<span class="p-flag low">Only ${p.stock_qty} left</span>` : ''}
      </div>
      <div class="p-info">
        <p class="p-brand">${esc(p.brand)}</p>
        <h3 class="p-name">${esc(p.name)}</h3>
        <div class="p-foot">
          <span class="p-price">${peso(p.price)}</span>
          ${p.old_price ? `<s class="p-was">${peso(p.old_price)}</s>` : ''}
          <span class="p-go" aria-hidden="true">${icon('arrow-right')}</span>
        </div>
      </div>
    </a>`;
}

// ── GOOGLE / FACEBOOK SIGN-IN ───────────────────
// Buttons with [data-social="google|facebook"] (sign-in window, register page).
// Signs in — or creates the account on first use — then goes where a sign-in would.
const SOCIAL_ICONS = {
  google:   '<svg class="soc-ico" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>',
  facebook: '<svg class="soc-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="#1877F2" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.62 23.1 24 18.1 24 12.07z"/></svg>',
};
function socialButtons() {
  return `<div class="soc-btns">
    <button type="button" class="btn-soc" data-social="google" aria-label="Continue with Google" title="Continue with Google">${SOCIAL_ICONS.google}<span class="sr-only">Continue with Google</span></button>
    <button type="button" class="btn-soc" data-social="facebook" aria-label="Continue with Facebook" title="Continue with Facebook">${SOCIAL_ICONS.facebook}<span class="sr-only">Continue with Facebook</span></button>
  </div>`;
}
function initSocialButtons() {
  document.addEventListener('click', async e => {
    const btn = e.target.closest('[data-social]');
    if (!btn || btn.disabled) return;
    e.preventDefault();
    const group = btn.closest('.soc-btns');
    const msg   = btn.closest('.si-dialog, .form-card')?.querySelector('.form-msg');
    const label = btn.querySelector('span');
    const text  = label.textContent;
    qsa('[data-social]', group).forEach(b => b.disabled = true);
    btn.classList.add('is-busy');
    label.textContent = 'Connecting…';
    const res = await apiSocialLogin(btn.dataset.social);
    if (res.ok) {
      label.textContent = res.is_new ? 'Account created!' : 'Welcome!';
      window.phLoaderShow?.();
      const next = safeNext();
      setTimeout(() => {
        if (next) location.href = next;
        else if (onPage('index.html', 'auth.html')) location.href = 'home.html';
        else location.reload();
      }, 300);
      return;
    }
    qsa('[data-social]', group).forEach(b => b.disabled = false);
    btn.classList.remove('is-busy');
    label.textContent = text;
    if (!res.cancelled) showMsg(msg, 'error', res.error || 'Sign-in failed');
  });
}

// ── SIGN-IN MODAL ───────────────────────────────
// Every "Sign In" link/button opens this window instead of a separate page.
// "Create an account" goes to auth.html (register); its "Sign in" link
// comes back to index.html?signin=1, which opens this window again.
function safeNext() {
  const n = new URLSearchParams(location.search).get('next');
  return n && /^[a-z-]+\.html(\?[\w=&%.-]*)?$/i.test(n) ? n : null;
}
function onPage(...names) {
  const page = location.pathname.split('/').pop() || 'index.html';
  return names.includes(page);
}
function openSignIn() {
  let m = qs('#signin-modal');
  if (!m) {
    m = document.createElement('div');
    m.id = 'signin-modal';
    m.className = 'si-overlay';
    m.innerHTML = `
      <div class="si-dialog" role="dialog" aria-modal="true" aria-labelledby="si-title">
        <button class="si-close" type="button" aria-label="Close">&times;</button>
        <div class="si-mark" aria-hidden="true">${icon('wheel')}</div>
        <h2 id="si-title">Welcome back</h2>
        <p class="si-sub">Sign in to reserve gear, track your orders and RSVP to rides.</p>
        <form id="si-form" novalidate>
          <label class="si-field"><span>Email</span>
            <input type="email" id="si-m-email" autocomplete="username" placeholder="you@example.com" required /></label>
          <label class="si-field"><span>Password</span>
            <span class="si-pass"><input type="password" id="si-m-pass" autocomplete="current-password" placeholder="Your password" required />
            <button type="button" class="si-eye" aria-label="Show password">Show</button></span></label>
          <p class="form-msg" id="si-m-msg" aria-live="polite"></p>
          <button class="btn-full" type="submit" id="si-m-submit">Sign In</button>
        </form>
        <div class="si-or"><span>or</span></div>
        ${socialButtons()}
        <div class="si-or"><span>New to PelotonHub?</span></div>
        <a href="auth.html" data-register class="btn-outline si-create">Create an account</a>
        ${onPage('index.html') ? '<a href="home.html?guest=1" class="si-guest">Continue as guest</a>' : ''}
      </div>`;
    document.body.appendChild(m);

    const close = () => { m.classList.remove('open'); document.body.style.overflow = ''; };
    m.querySelector('.si-close').addEventListener('click', close);
    m.addEventListener('click', e => { if (e.target === m) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && m.classList.contains('open')) close(); });
    const eye = m.querySelector('.si-eye'), pass = m.querySelector('#si-m-pass');
    eye.addEventListener('click', () => {
      const show = pass.type === 'password';
      pass.type = show ? 'text' : 'password';
      eye.textContent = show ? 'Hide' : 'Show';
    });

    m.querySelector('#si-form').addEventListener('submit', async e => {
      e.preventDefault();
      const email = m.querySelector('#si-m-email').value.trim();
      const msg   = m.querySelector('#si-m-msg');
      const btn   = m.querySelector('#si-m-submit');
      if (!email || !pass.value) return showMsg(msg, 'error', 'Enter your email and password.');
      btn.disabled = true; btn.textContent = 'Signing in…';
      const res = await apiLogin({ email, password: pass.value });
      if (res.ok) {
        btn.textContent = 'Welcome!';
        const next = safeNext();
        setTimeout(() => {
          if (next) location.href = next;
          else if (onPage('index.html', 'auth.html')) location.href = 'home.html';
          else location.reload();
        }, 350);
      } else {
        btn.disabled = false; btn.textContent = 'Sign In';
        showMsg(msg, 'error', res.error || 'Sign-in failed');
        const d = m.querySelector('.si-dialog');
        d.classList.remove('shake'); void d.offsetWidth; d.classList.add('shake');
      }
    });
  }
  m.classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => m.querySelector('#si-m-email').focus(), 80);
}
function initSignInLinks() {
  // Sign-in links (not "create account" ones) open the modal on the spot
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href="auth.html"]:not([data-register]), [data-signin]');
    if (!a) return;
    e.preventDefault();
    openSignIn();
  });
  if (new URLSearchParams(location.search).get('signin') === '1') openSignIn();
}

// ── NAVBAR AUTH BUTTON ──────────────────────────
function initAuthButton(customer) {
  // customer = the shopper's profile (apiMe), or null when signed out — or signed in
  // with an account that isn't a customer (e.g. the admin). Those see "Sign In",
  // which opens the sign-in window right on the page they're on.
  const btn  = qs('#nav-auth-btn');
  const acct = qs('.app-tabbar a[data-tab="account"]');
  if (customer) {
    if (btn)  { btn.textContent = customer.first_name || (customer.name || 'Me').split(' ')[0]; btn.href = 'profile.html'; }
    if (acct) { acct.href = 'profile.html'; acct.querySelector('span:last-child').textContent = 'Account'; }
  } else {
    if (btn)  { btn.textContent = 'Sign In'; btn.href = 'auth.html'; }
    if (acct) { acct.href = 'auth.html'; acct.querySelector('span:last-child').textContent = 'Sign In'; }
  }
}

// ── CURRENT USER ────────────────────────────────
// Firebase restores the session asynchronously; wait for the first auth
// event before asking who is signed in. Resolves to the profile or null.
const authReady = new Promise(resolve => {
  const unsub = onAuthStateChanged(auth, u => { unsub(); resolve(u); });
});
async function getUser() {
  await authReady;
  const res = await apiMe();
  return res.ok ? res.user : null;
}

// ── MEMBERSHIP TIER CARDS (home + membership page) ──
// Live discount % from Admin → Membership Tiers, and buttons that make sense
// for who is looking: signed out → create an account; signed in → current
// tier is marked, higher tiers open the upgrade payment on membership.html,
// lower tiers ask the shop through Support (nothing to pay).
const TIER_RANK = { Spoke: 0, Chain: 1, Peloton: 2 };
async function initTierCards() {
  const cards = qsa('[data-tier-card]');
  const discEls = qsa('[data-disc]');
  if (!cards.length && !discEls.length) return;
  const ready = holdLoader();
  const [{ settings }, user] = await Promise.all([apiSettingsGet(), getUser()]).finally(ready);
  discEls.forEach(el => {
    const v = settings['tier_discount_' + el.dataset.disc];
    if (v != null) el.textContent = v;
  });
  cards.forEach(card => {
    const tier = card.dataset.tierCard;
    const btn  = card.querySelector('.tier-join');
    if (!btn) return;
    if (!user) {
      btn.href = tier === 'Spoke' ? 'auth.html' : `auth.html?tier=${tier}`;
      btn.setAttribute('data-register', '');
      btn.querySelector('button').textContent = tier === 'Spoke' ? 'Join Free' : `Join, then go ${tier}`;
    } else if (user.tier === tier) {
      btn.removeAttribute('href');
      btn.classList.add('is-current');
      btn.querySelector('button').textContent = '✓ Your current tier';
      btn.querySelector('button').disabled = true;
    } else if (TIER_RANK[tier] > (TIER_RANK[user.tier] ?? 0)) {
      btn.href = `membership.html?upgrade=${tier}`;
      btn.querySelector('button').textContent = `Upgrade to ${tier}`;
    } else {
      btn.href = `support.html?topic=Membership&tier=${tier}`;
      btn.querySelector('button').textContent = `Switch to ${tier}`;
    }
  });
}

// ── FANCY SELECT ────────────────────────────────
// <select data-fancy> becomes a styled button + option list. The real select stays in
// the DOM (hidden) and still fires 'change', so page scripts don't need to know.
function initFancySelects() {
  qsa('select[data-fancy]').forEach(sel => {
    if (sel.dataset.fancyReady) return;
    sel.dataset.fancyReady = '1';
    const uid = sel.id || 'fs' + Math.random().toString(36).slice(2, 7);
    const wrap = document.createElement('div');
    wrap.className = 'fsel';
    wrap.innerHTML = `
      <button type="button" class="fsel-btn" aria-haspopup="listbox" aria-expanded="false" aria-controls="${uid}-list">
        ${sel.dataset.fancyLabel ? `<span class="fsel-label">${esc(sel.dataset.fancyLabel)}</span>` : ''}
        <span class="fsel-value"></span>
        <svg class="fsel-caret" viewBox="0 0 24 24" aria-hidden="true"><path d="m6.5 9.5 5.5 5.5 5.5-5.5"/></svg>
      </button>
      <ul class="fsel-list" id="${uid}-list" role="listbox" tabindex="-1" aria-label="${esc(sel.getAttribute('aria-label') || '')}"></ul>`;
    sel.before(wrap);
    wrap.appendChild(sel);
    sel.hidden = true; sel.tabIndex = -1;
    const btn = wrap.querySelector('.fsel-btn'), list = wrap.querySelector('.fsel-list'), val = wrap.querySelector('.fsel-value');
    let active = 0;

    const opts = () => [...list.children];
    function render() {
      list.innerHTML = [...sel.options].map((o, i) => `
        <li role="option" id="${uid}-o${i}" data-i="${i}" aria-selected="${o.selected}" class="${o.selected ? 'is-selected' : ''}">
          <span>${esc(o.textContent)}</span>
          <svg class="fsel-check" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>
        </li>`).join('');
      val.textContent = sel.options[sel.selectedIndex]?.textContent || '';
    }
    function setActive(i) {
      const o = opts(); active = (i + o.length) % o.length;
      o.forEach((li, k) => li.classList.toggle('is-active', k === active));
      list.setAttribute('aria-activedescendant', o[active].id);
    }
    function open() {
      if (wrap.classList.contains('open')) return;
      render(); wrap.classList.add('open'); btn.setAttribute('aria-expanded', 'true');
      setActive(sel.selectedIndex); list.focus({ preventScroll: true });
    }
    function close(focusBtn = true) {
      if (!wrap.classList.contains('open')) return;
      wrap.classList.remove('open'); btn.setAttribute('aria-expanded', 'false');
      if (focusBtn) btn.focus({ preventScroll: true });
    }
    function choose(i) {
      const changed = sel.selectedIndex !== i;
      sel.selectedIndex = i; render(); close();
      if (changed) sel.dispatchEvent(new Event('change', { bubbles: true }));
    }

    btn.addEventListener('click', () => wrap.classList.contains('open') ? close() : open());
    btn.addEventListener('keydown', e => { if (['ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); open(); } });
    list.addEventListener('click', e => { const li = e.target.closest('li'); if (li) choose(+li.dataset.i); });
    list.addEventListener('pointermove', e => { const li = e.target.closest('li'); if (li && +li.dataset.i !== active) setActive(+li.dataset.i); });
    list.addEventListener('keydown', e => {
      const k = e.key;
      if (k === 'ArrowDown') setActive(active + 1);
      else if (k === 'ArrowUp') setActive(active - 1);
      else if (k === 'Home') setActive(0);
      else if (k === 'End') setActive(opts().length - 1);
      else if (k === 'Enter' || k === ' ') choose(active);
      else if (k === 'Escape') close();
      else if (k === 'Tab') { close(false); return; }
      else return;
      e.preventDefault();
    });
    document.addEventListener('pointerdown', e => { if (!wrap.contains(e.target)) close(false); });
    sel.addEventListener('change', render);
    render();
  });
}

// ── APP INSTALL (PWA / APK) ─────────────────────
function registerServiceWorker() {
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

// ── INIT ────────────────────────────────────────
function init() {
  initNav();
  injectTabbar();
  injectBackButton();
  initPullToRefresh();
  initSignInLinks();         // before page transitions so sign-in links aren't followed
  initSocialButtons();
  initReveal();
  initPageTransitions();
  registerServiceWorker();
  initTierCards();
  initFancySelects();

  // ── AUTH STATE — wires everything together ──
  onAuthStateChanged(auth, async (firebaseUser) => {
    const customer = firebaseUser ? (await apiMe().catch(() => ({}))).user : null;
    initAuthButton(customer);
    releaseAuthHold();
    if (customer) await refreshCartBadge();
    else setBadges(0);
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

// ── EXPORTS (used by page-specific inline scripts) ──
export { socialButtons, holdLoader, icon, qs, qsa, esc, peso, Toast, showMsg, refreshCartBadge, getUser, apiLogout, flyToCart, confetti, skeletonCards, productCard, openSignIn };
