/* =============================================================
   PelotonHub Admin — admin.js
   Loaded after shared-data.js on every admin/*.html page.
   Handles: admin auth guard, sidebar/topbar interactivity, and a
   localStorage-backed data store for orders, customers, and
   support messages. The store starts empty — real rows appear
   once the storefront is used, or once this is wired to a real
   database/API instead of localStorage.
   ============================================================= */

// ── ADMIN AUTH ───────────────────────────────────────────────
const AdminAuth = {
  get() { try { return JSON.parse(localStorage.getItem('ph_admin_user') || 'null'); } catch { return null; } },
  isLoggedIn() { return !!AdminAuth.get(); },
  login(email) { localStorage.setItem('ph_admin_user', JSON.stringify({ email, name: 'Shop Admin', initials: 'SA' })); },
  logout() { localStorage.removeItem('ph_admin_user'); }
};

function fmtDate(d) { return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }); }
function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60); if (h < 24) return h + 'h ago';
  const dd = Math.floor(h / 24); if (dd < 30) return dd + 'd ago';
  return fmtDate(new Date(ts));
}

const AdminStore = {
  KEYS: { orders: 'ph_admin_orders', customers: 'ph_admin_customers', messages: 'ph_admin_messages', overrides: 'ph_admin_product_overrides', custom: 'ph_admin_custom_products', settings: 'ph_admin_settings' },
  // Bumped once: any browser still holding onto the old randomly-generated
  // demo orders/customers/messages/stock numbers gets wiped back to blank
  // on next load. Real per-customer data (ph_orders_<email>, ph_user,
  // ph_support_tickets) lives under different keys and is untouched.
  DATA_VERSION: 'blank-v1',

  _read(key, fallback) { try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch { return fallback; } },
  _write(key, val) { localStorage.setItem(key, JSON.stringify(val)); },

  ensureSeeded() {
    // No mock/demo data — this admin console is blank until it's wired
    // up to a real database. Only a sane default for tier discounts is
    // set (mirroring the storefront's own Spoke/Chain/Peloton config),
    // since that's real configuration, not fabricated activity.
    if (localStorage.getItem('ph_admin_data_version') !== this.DATA_VERSION) {
      this._write(this.KEYS.orders, []);
      this._write(this.KEYS.customers, []);
      this._write(this.KEYS.messages, []);
      localStorage.setItem('ph_admin_data_version', this.DATA_VERSION);
    }
    if (!localStorage.getItem(this.KEYS.orders)) this._write(this.KEYS.orders, []);
    if (!localStorage.getItem(this.KEYS.customers)) this._write(this.KEYS.customers, []);
    if (!localStorage.getItem(this.KEYS.messages)) this._write(this.KEYS.messages, []);
    if (!localStorage.getItem(this.KEYS.settings)) this._write(this.KEYS.settings, { tierDiscount: { ...TIER_DISCOUNT } });
  },

  // ── LIVE data: real activity from THIS browser's storefront session ──
  // The storefront has no server, so "connected" means both sides read
  // the same origin's localStorage. A real reservation placed on
  // orders.html/cart.html (key ph_orders_<email>) or a real ticket
  // submitted on support.html (key ph_support_tickets) shows up here
  // tagged live:true, merged alongside the seeded demo rows.
  // Reads the storefront's real logged-in user directly from localStorage
  // (admin pages don't load js/main.js, so we can't rely on the Auth object).
  currentStorefrontUser() {
    try { return JSON.parse(localStorage.getItem('ph_user') || 'null'); } catch { return null; }
  },

  liveOrders() {
    const out = [];
    const me = this.currentStorefrontUser();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || key.indexOf('ph_orders_') !== 0) continue;
      const email = key.slice('ph_orders_'.length);
      let list;
      try { list = JSON.parse(localStorage.getItem(key) || '[]'); } catch { continue; }
      const tierGuess = (o) => Object.keys(TIER_DISCOUNT).find(t => TIER_DISCOUNT[t] === o.discountPct) || (o.discountPct ? '' : 'Spoke');
      list.forEach(o => {
        const items = (o.items || []).map(it => {
          const p = getProduct(it.id);
          return { id: it.id, name: p ? p.name : it.id, price: p ? p.price : 0, qty: it.qty || 1 };
        });
        const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
        const total = Math.round(subtotal * (1 - (o.discountPct || 0) / 100));
        const ts = Date.parse(o.date) || Date.now();
        const name = (email !== 'guest' && me && me.email === email) ? me.name : (email === 'guest' ? 'Guest Checkout' : cap(email.split('@')[0].replace(/[._]/g, ' ')));
        out.push({
          id: o.id, customerName: name, customerEmail: email, tier: tierGuess(o) || 'Spoke',
          ts, date: o.date, items, subtotal, discountPct: o.discountPct || 0, total,
          status: o.status, pickupDate: o.pickupDate, pickupTime: o.pickupTime, live: true
        });
      });
    }
    return out;
  },

  orders() {
    const combined = [...this.liveOrders(), ...this._read(this.KEYS.orders, [])];
    return combined.sort((a, b) => b.ts - a.ts);
  },
  saveOrders(list) { this._write(this.KEYS.orders, list.filter(o => !o.live)); },
  setOrderStatus(id, status) {
    // Live order: it lives in the real ph_orders_<email> key, edit it there.
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || key.indexOf('ph_orders_') !== 0) continue;
      try {
        const list = JSON.parse(localStorage.getItem(key) || '[]');
        const o = list.find(x => x.id === id);
        if (o) { o.status = status; localStorage.setItem(key, JSON.stringify(list)); return; }
      } catch { /* skip malformed key */ }
    }
    // Otherwise it's a seeded demo order.
    const list = this._read(this.KEYS.orders, []);
    const o = list.find(x => x.id === id);
    if (o) { o.status = status; this._write(this.KEYS.orders, list); }
  },

  liveCustomers() {
    const seen = {};
    const me = this.currentStorefrontUser();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || key.indexOf('ph_orders_') !== 0) continue;
      const email = key.slice('ph_orders_'.length);
      if (email === 'guest' || seen[email]) continue;
      seen[email] = true;
    }
    if (me && me.email) seen[me.email] = true;
    return Object.keys(seen).map(email => {
      const isMe = me && me.email === email;
      return {
        name: isMe ? me.name : cap(email.split('@')[0].replace(/[._]/g, ' ')),
        email, tier: isMe ? me.tier : 'Spoke',
        joined: 'This browser session', phone: '', status: 'active', live: true
      };
    });
  },
  customers() { return [...this.liveCustomers(), ...this._read(this.KEYS.customers, [])]; },
  saveCustomers(list) { this._write(this.KEYS.customers, list.filter(c => !c.live)); },
  customerStats(email) {
    const list = this.orders().filter(o => o.customerEmail === email && o.status !== 'cancelled');
    return { count: list.length, spend: list.reduce((s, o) => s + o.total, 0) };
  },

  liveMessages() {
    try { return (JSON.parse(localStorage.getItem('ph_support_tickets') || '[]')).map(m => ({ ...m, orderRef: m.orderRef || '', live: true })); }
    catch { return []; }
  },
  messages() {
    const combined = [...this.liveMessages(), ...this._read(this.KEYS.messages, [])];
    return combined.sort((a, b) => b.ts - a.ts);
  },
  saveMessages(list) { this._write(this.KEYS.messages, list.filter(m => !m.live)); },
  setMessageStatus(id, status) {
    try {
      const real = JSON.parse(localStorage.getItem('ph_support_tickets') || '[]');
      const rm = real.find(x => x.id === id);
      if (rm) { rm.status = status; localStorage.setItem('ph_support_tickets', JSON.stringify(real)); return; }
    } catch { /* fall through to demo store */ }
    const list = this._read(this.KEYS.messages, []);
    const m = list.find(x => x.id === id);
    if (m) { m.status = status; this._write(this.KEYS.messages, list); }
  },

  overrides() { return this._read(this.KEYS.overrides, {}); },
  saveOverrides(ov) { this._write(this.KEYS.overrides, ov); },
  setOverride(id, patch) {
    const ov = this.overrides();
    ov[id] = { ...(ov[id] || {}), ...patch };
    this.saveOverrides(ov);
  },
  customProducts() { return this._read(this.KEYS.custom, []); },
  saveCustomProducts(list) { this._write(this.KEYS.custom, list); },
  addCustomProduct(p) { const list = this.customProducts(); list.unshift(p); this.saveCustomProducts(list); },
  removeCustomProduct(id) { this.saveCustomProducts(this.customProducts().filter(p => p.id !== id)); },
  deletedIds() { return this._read('ph_admin_deleted_products', []); },
  softDeleteProduct(id) { const d = this.deletedIds(); if (!d.includes(id)) d.push(id); this._write('ph_admin_deleted_products', d); },

  // stable pseudo stock-on-hand number per product, editable via overrides
  // Returns null until an admin has actually set a real stock count for
  // this product (via the Edit modal). No number is invented — a real
  // inventory field belongs in the database, not guessed on the frontend.
  stockFor(id) {
    const ov = this.overrides();
    if (ov[id] && typeof ov[id].stock === 'number') return ov[id].stock;
    return null;
  },

  allProducts() {
    const ov = this.overrides();
    const deleted = this.deletedIds();
    const base = PRODUCTS.filter(p => !deleted.includes(p.id)).map(p => ({ ...p, ...(ov[p.id] || {}) }));
    const custom = this.customProducts().filter(p => !deleted.includes(p.id)).map(p => ({ ...p, ...(ov[p.id] || {}) }));
    return [...custom, ...base];
  },

  settings() { return this._read(this.KEYS.settings, { tierDiscount: { ...TIER_DISCOUNT } }); },
  saveSettings(s) { this._write(this.KEYS.settings, s); },

  // ── Events (RSVP management) ──
  eventOverrides() { return this._read('ph_admin_event_overrides', {}); },
  saveEventOverrides(ov) { this._write('ph_admin_event_overrides', ov); },
  setEventOverride(id, patch) { const ov = this.eventOverrides(); ov[id] = { ...(ov[id] || {}), ...patch }; this.saveEventOverrides(ov); },
  customEvents() { return this._read('ph_admin_custom_events', []); },
  saveCustomEvents(list) { this._write('ph_admin_custom_events', list); },
  addCustomEvent(e) { const list = this.customEvents(); list.unshift(e); this.saveCustomEvents(list); },
  deletedEventIds() { return this._read('ph_admin_deleted_events', []); },
  softDeleteEvent(id) { const d = this.deletedEventIds(); if (!d.includes(id)) d.push(id); this._write('ph_admin_deleted_events', d); },
  allEvents() {
    const ov = this.eventOverrides();
    const deleted = this.deletedEventIds();
    const base = EVENTS.filter(e => !deleted.includes(e.id)).map(e => ({ ...e, ...(ov[e.id] || {}) }));
    const custom = this.customEvents().filter(e => !deleted.includes(e.id)).map(e => ({ ...e, ...(ov[e.id] || {}) }));
    return [...custom, ...base];
  }
};

// ── SIDEBAR / TOPBAR CHROME ─────────────────────────────────
function initAdminChrome() {
  const page = location.pathname.split('/').pop() || 'index.html';
  qsa('.admin-nav a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === page));

  const toggle = qs('#admin-sidebar-toggle');
  const sidebar = qs('.admin-sidebar');
  if (toggle && sidebar) {
    toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
    document.addEventListener('click', (e) => {
      if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== toggle) sidebar.classList.remove('open');
    });
  }

  const user = AdminAuth.get();
  const nameEl = qs('#admin-who-name');
  const avaEl = qs('#admin-who-avatar');
  if (user) {
    if (nameEl) nameEl.textContent = user.name;
    if (avaEl) avaEl.textContent = user.initials;
  }
  const logoutBtn = qs('#admin-logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', () => { AdminAuth.logout(); location.href = 'login.html'; });
}

function guardAdminPage() {
  const page = location.pathname.split('/').pop() || 'index.html';
  if (page === 'login.html') {
    if (AdminAuth.isLoggedIn()) location.replace('index.html');
    return;
  }
  if (!AdminAuth.isLoggedIn()) { location.replace('login.html'); return; }
  AdminStore.ensureSeeded();
  initAdminChrome();
}

document.addEventListener('DOMContentLoaded', guardAdminPage);
