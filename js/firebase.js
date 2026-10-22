/* ================================================================
   PelotonHub — firebase.js
   Firebase SDK v9 (modular) initialisation + Firestore/Auth helpers.

   This file is the COMPLETE replacement for all PHP API endpoints.
   Every function returns the same JSON shape the old PHP APIs returned
   so existing HTML pages need minimal changes.

   HOW TO USE:
   1.  Go to https://console.firebase.google.com/
   2.  Create a project (e.g. "pelotonhub")
   3.  Add a Web App — copy the firebaseConfig object below
   4.  Enable Authentication → Email/Password provider
   5.  Enable Firestore Database (start in test mode, then lock down rules)
   6.  Run firebase-seed.js ONCE via the browser console to seed data
   ================================================================ */

import { initializeApp }                     from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  signInWithCredential,
}                                             from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore,
  doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  collection, collectionGroup,
  query, where, orderBy, limit, startAfter,
  runTransaction, writeBatch,
  serverTimestamp, Timestamp,
  increment,
  getCountFromServer,
}                                             from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { emailNewTicket, emailTicketReply }  from './email.js';

// ── FIREBASE CONFIG ──────────────────────────────────────────
// Replace with your own project's config from the Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyB5sLMeG8A2pHE5OFUEZPqVd18VH-7_y4Q",
  authDomain: "peletonhub.firebaseapp.com",
  databaseURL: "https://peletonhub-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "peletonhub",
  storageBucket: "peletonhub.firebasestorage.app",
  messagingSenderId: "943654190066",
  appId: "1:943654190066:web:384be2478ee3e95d60896b",
  measurementId: "G-95FQPBRK6E"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── INTERNAL HELPERS ─────────────────────────────────────────

/** Local date-time as 'YYYY-MM-DDTHH:mm:ss' (the shop's own clock, not UTC).
 *  Pages show .slice(0, 10) as the date, so it must be the local calendar day. */
function localISO(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** Convert a Firestore Timestamp / Date / ISO string to a local date-time string */
function toISO(ts) {
  if (!ts) return null;
  if (ts instanceof Timestamp) return localISO(ts.toDate());
  if (ts instanceof Date)      return localISO(ts);
  return String(ts);
}

/** Slugify a string for use as a Firestore document ID */
function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Generate order ID: PH-YYYYMMDD-XXXX */
function makeOrderId() {
  const date   = localISO(new Date()).slice(0, 10).replace(/-/g, '');
  const suffix = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
  return `PH-${date}-${suffix}`;
}

/** Get the current signed-in user's Firestore profile document */
async function getCurrentUserDoc() {
  const u = auth.currentUser;
  if (!u) return null;
  const snap = await getDoc(doc(db, 'users', u.uid));
  if (!snap.exists()) return null;
  return { uid: u.uid, ...snap.data() };
}

/** Get admin role flag from Firestore admins collection */
/** Get admin role flag from Firestore admins collection.
 *  Cached per signed-in user: every page makes this read once, not once per call. */
let _adminCache = { uid: null, promise: null };
async function getCurrentAdminDoc() {
  const u = auth.currentUser;
  if (!u) return null;
  if (_adminCache.uid !== u.uid) {
    _adminCache = {
      uid: u.uid,
      promise: getDoc(doc(db, 'admins', u.uid))
        .then(snap => (snap.exists() ? { uid: u.uid, ...snap.data() } : null))
        .catch(() => null),
    };
  }
  return _adminCache.promise;
}

/** Customer name, email and tier for a list of user ids, fetched in parallel (one round trip). */
async function getUsersById(ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  const snaps  = await Promise.all(unique.map(uid => getDoc(doc(db, 'users', uid))));
  const map = {};
  snaps.forEach((snap, i) => {
    if (snap.exists()) {
      const u = snap.data();
      map[unique[i]] = { name: u.name || `${u.first_name} ${u.last_name}`, email: u.email, tier: u.tier };
    }
  });
  return map;
}

/** Order lines: stored on the order since the speed-up; older orders keep them in a sub-collection. */
async function getOrderItems(orderId, orderData) {
  if (Array.isArray(orderData.items)) return orderData.items;
  const snap = await getDocs(collection(db, 'orders', orderId, 'items'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Expose low-level firebase instances for advanced use
export { app, auth, db, onAuthStateChanged, serverTimestamp, Timestamp };

// ════════════════════════════════════════════════════════════
//  AUTH  ( replaces /api/login.php, register.php, logout.php, me.php )
// ════════════════════════════════════════════════════════════

/**
 * Register a new customer.
 * Mirrors: POST /api/register.php
 * Returns: { ok, user }
 */
export async function apiRegister({ first_name, last_name, email, mobile = '', password, tier = 'Spoke' }) {
  if (!first_name || !last_name)    return { ok: false, error: 'Name is required' };
  if (!email || !email.includes('@')) return { ok: false, error: 'Invalid email' };
  if (!password || password.length < 8) return { ok: false, error: 'Password must be at least 8 characters' };
  if (!['Spoke', 'Chain', 'Peloton'].includes(tier)) tier = 'Spoke';

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const uid  = cred.user.uid;

    await updateProfile(cred.user, { displayName: `${first_name} ${last_name}` });

    const userData = {
      first_name,
      last_name,
      name: `${first_name} ${last_name}`,
      email: email.toLowerCase(),
      mobile,
      tier,
      points:     0,
      status:     'active',
      created_at: serverTimestamp(),
    };
    await setDoc(doc(db, 'users', uid), userData);

    const user = { id: uid, ...userData, created_at: localISO(new Date()) };
    return { ok: true, user };
  } catch (e) {
    if (e.code === 'auth/email-already-in-use')
      return { ok: false, error: 'An account with that email already exists' };
    return { ok: false, error: e.message };
  }
}

/**
 * Sign in a customer.
 * Mirrors: POST /api/login.php
 * Returns: { ok, user }
 */
export async function apiLogin({ email, password }) {
  if (!email || !password) return { ok: false, error: 'Email and password are required' };
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const uid  = cred.user.uid;
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return { ok: false, error: 'User profile not found' };
    const data = snap.data();
    if (data.status === 'suspended') {
      await signOut(auth);
      return { ok: false, error: 'This account has been suspended' };
    }
    const user = {
      id:         uid,
      first_name: data.first_name,
      last_name:  data.last_name,
      name:       data.name || `${data.first_name} ${data.last_name}`,
      email:      data.email,
      tier:       data.tier,
      points:     data.points || 0,
    };
    return { ok: true, user };
  } catch (e) {
    if (e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found')
      return { ok: false, error: 'Incorrect email or password' };
    return { ok: false, error: e.message };
  }
}

/**
 * Sign in (or sign up) with Google or Facebook.
 * Website: the provider's pop-up window.
 * APK: Google and Facebook block sign-in inside app web views, so the native
 * FirebaseAuthentication plugin (@capacitor-firebase/authentication) shows the
 * phone's own account picker and hands back a token we sign in with here.
 * First sign-in creates the shop profile (users/{uid}) the same way apiRegister does.
 * Returns: { ok, user, is_new } — or { ok:false, cancelled:true } if the person backed out.
 */
function nativeAuthPlugin() {
  const cap = window.Capacitor;
  if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return null;
  return cap.Plugins?.FirebaseAuthentication || cap.registerPlugin?.('FirebaseAuthentication') || null;
}

export async function apiSocialLogin(providerName) {
  const isGoogle = providerName === 'google';
  try {
    let cred;
    const native = nativeAuthPlugin();
    if (native) {
      if (isGoogle) {
        const r = await native.signInWithGoogle();
        cred = await signInWithCredential(auth, GoogleAuthProvider.credential(r.credential?.idToken, r.credential?.accessToken));
      } else {
        const r = await native.signInWithFacebook();
        cred = await signInWithCredential(auth, FacebookAuthProvider.credential(r.credential?.accessToken));
      }
    } else {
      const provider = isGoogle ? new GoogleAuthProvider() : new FacebookAuthProvider();
      if (isGoogle) provider.setCustomParameters({ prompt: 'select_account' });
      else provider.addScope('email');
      cred = await signInWithPopup(auth, provider);
    }

    const fu   = cred.user;
    const ref  = doc(db, 'users', fu.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      if (data.status === 'suspended') {
        await signOut(auth);
        return { ok: false, error: 'This account has been suspended' };
      }
      return { ok: true, is_new: false, user: { id: fu.uid, ...data } };
    }

    // First time: make the shop profile from the Google/Facebook account
    const parts = (fu.displayName || '').trim().split(/\s+/).filter(Boolean);
    const first_name = parts.length ? parts.slice(0, -1).join(' ') || parts[0] : (fu.email || 'Rider').split('@')[0];
    const last_name  = parts.length > 1 ? parts[parts.length - 1] : '';
    const userData = {
      first_name,
      last_name,
      name:       [first_name, last_name].filter(Boolean).join(' '),
      email:      (fu.email || '').toLowerCase(),
      mobile:     fu.phoneNumber || '',
      tier:       'Spoke',
      points:     0,
      status:     'active',
      provider:   isGoogle ? 'google' : 'facebook',
      created_at: serverTimestamp(),
    };
    await setDoc(ref, userData);
    return { ok: true, is_new: true, user: { id: fu.uid, ...userData, created_at: localISO(new Date()) } };
  } catch (e) {
    const code = e.code || '';
    const msg  = String(e.message || e);
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request' || /cancel/i.test(msg))
      return { ok: false, cancelled: true };
    if (code === 'auth/popup-blocked')
      return { ok: false, error: 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.' };
    if (code === 'auth/account-exists-with-different-credential')
      return { ok: false, error: 'That email already has a PelotonHub account. Sign in with your email and password instead.' };
    if (code === 'auth/operation-not-allowed')
      return { ok: false, error: (isGoogle ? 'Google' : 'Facebook') + ' sign-in isn’t turned on yet.' };
    return { ok: false, error: msg };
  }
}

/**
 * Sign out the current customer.
 * Mirrors: POST /api/logout.php
 * Returns: { ok }
 */
export async function apiLogout() {
  try {
    // APK: also forget the phone's Google/Facebook choice, so the next sign-in can pick another account
    try { await nativeAuthPlugin()?.signOut(); } catch {}
    await signOut(auth);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Get the currently signed-in customer.
 * Mirrors: GET /api/me.php
 * Returns: { ok, user } — user is null if not signed in
 */
export async function apiMe() {
  try {
    const u = auth.currentUser;
    if (!u) return { ok: true, user: null };
    const snap = await getDoc(doc(db, 'users', u.uid));
    if (!snap.exists()) return { ok: true, user: null };
    const data = snap.data();
    if (data.status === 'suspended') return { ok: true, user: null };
    return {
      ok: true,
      user: {
        id:         u.uid,
        first_name: data.first_name,
        last_name:  data.last_name,
        name:       data.name || `${data.first_name} ${data.last_name}`,
        email:      data.email,
        mobile:     data.mobile  || '',
        address:    data.address || '',
        notifications: Array.isArray(data.notifications) ? data.notifications : null,
        tier:       data.tier   || 'Spoke',
        points:     data.points || 0,
        status:     data.status || 'active',
      },
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ════════════════════════════════════════════════════════════
//  CATALOG  ( replaces /api/catalog.php )
// ════════════════════════════════════════════════════════════

/**
 * Fetch product list with optional filters, or a single product by id.
 * Mirrors: GET /api/catalog.php
 * Returns: { ok, products[], total, page, per_page, filters } OR { ok, product }
 *
 * NOTE: Firestore does not support full-text search. Text search (q=) is
 * handled client-side after fetching. For production, use Algolia or
 * Firestore's built-in search extension.
 */
export async function apiCatalog({ id, q, cat, sub, brand, stock, tag, sort = 'name_asc', page = 1, per_page = 12 } = {}) {
  try {
    // ── Single product lookup ──────────────────────────────
    if (id) {
      const snap = await getDoc(doc(db, 'products', id));
      if (!snap.exists() || snap.data().deleted) return { ok: false, error: 'Product not found' };
      const p = { id: snap.id, ...snap.data() };
      p.specs = typeof p.specs === 'string' ? JSON.parse(p.specs) : (p.specs || []);
      p.sizes = typeof p.sizes === 'string' ? JSON.parse(p.sizes) : (p.sizes || null);
      p.created_at = toISO(p.created_at);
      p.updated_at = toISO(p.updated_at);

      // Reviews sub-collection
      const revSnap = await getDocs(
        query(collection(db, 'products', id, 'reviews'), orderBy('created_at', 'desc'))
      );
      p.reviews = revSnap.docs.map(d => ({ id: d.id, ...d.data(), created_at: toISO(d.data().created_at) }));
      return { ok: true, product: p };
    }

    // ── List query ─────────────────────────────────────────
    // One query for every live product; filters and sorting run in the
    // browser, so no combination of filters needs its own composite index.
    const allSnap = await getDocs(query(collection(db, 'products'), where('deleted', '==', false)));
    const allDocs = allSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    let products = allDocs.map(d => ({
      id:           d.id,
      name:         d.name,
      price:        d.price,
      old_price:    d.old_price  || null,
      category:     d.category,
      sub_category: d.sub_category,
      brand:        d.brand,
      in_stock:     d.in_stock,
      stock_qty:    d.stock_qty ?? null,
      icon:         d.icon        || '',
      tag:          d.tag         || '',
      image:        d.image       || null,
      short_desc:   d.short_desc  || '',
      created_at:   toISO(d.created_at),
    }));

    if (cat)             products = products.filter(p => p.category     === cat);
    if (sub)             products = products.filter(p => p.sub_category === sub);
    if (tag)             products = products.filter(p => p.tag          === tag);
    if (stock === 'in')  products = products.filter(p => p.in_stock);
    if (stock === 'out') products = products.filter(p => !p.in_stock);

    const sorters = {
      price_asc:  (a, b) => a.price - b.price,
      price_desc: (a, b) => b.price - a.price,
      name_asc:   (a, b) => a.name.localeCompare(b.name),
      newest:     (a, b) => (b.created_at || '').localeCompare(a.created_at || ''),
    };
    products.sort(sorters[sort] || sorters.name_asc);

    // Client-side text search
    if (q) {
      const lq = q.toLowerCase();
      products = products.filter(p =>
        p.name.toLowerCase().includes(lq)       ||
        p.brand.toLowerCase().includes(lq)      ||
        (p.short_desc || '').toLowerCase().includes(lq)
      );
    }

    // Client-side brand filter (supports comma-separated brands)
    if (brand) {
      const brands = brand.split(',').map(b => b.trim().toLowerCase());
      products = products.filter(p => brands.includes(p.brand.toLowerCase()));
    }

    const total = products.length;

    // Pagination (client-side after filtering)
    const offset = (page - 1) * per_page;
    const paged  = products.slice(offset, offset + per_page);

    // Distinct filter values
    const filterDocs    = allDocs;
    const categories    = [...new Set(filterDocs.map(d => d.category))].sort();
    const sub_categories = [...new Set(filterDocs.map(d => d.sub_category))].sort();
    const brands        = [...new Set(filterDocs.map(d => d.brand))].sort();
    // How many live products each filter option would show (for the filter list)
    const tally = key => filterDocs.reduce((m, d) => (m[d[key]] = (m[d[key]] || 0) + 1, m), {});
    const counts = { category: tally('category'), sub_category: tally('sub_category'), brand: tally('brand') };

    return {
      ok:       true,
      products: paged,
      total,
      page,
      per_page,
      filters:  { categories, sub_categories, brands, counts },
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ════════════════════════════════════════════════════════════
//  CART  ( replaces /api/cart.php )
//  Cart stored in: users/{uid}/cart/{product_id_size}
// ════════════════════════════════════════════════════════════

function cartDocId(product_id, size) {
  return size ? `${product_id}__${size}` : product_id;
}

async function getCartLines(uid) {
  const snap = await getDocs(collection(db, 'users', uid, 'cart'));
  return snap.docs.map(d => ({ ...d.data(), _docId: d.id }));
}

/**
 * Mirrors: GET /api/cart.php
 * Returns: { ok, cart[] }
 */
export async function apiCartGet() {
  const u = auth.currentUser;
  if (!u) return { ok: false, error: 'Not logged in', cart: [] };
  try {
    const cart = await getCartLines(u.uid);
    return { ok: true, cart };
  } catch (e) {
    return { ok: false, error: e.message, cart: [] };
  }
}

/**
 * Mirrors: POST /api/cart.php  action=add
 * Returns: { ok, cart[] }
 */
export async function apiCartAdd({ product_id, qty = 1, size = null }) {
  const u = auth.currentUser;
  if (!u) return { ok: false, error: 'Not logged in' };
  try {
    // Check product exists and in stock
    const pSnap = await getDoc(doc(db, 'products', product_id));
    if (!pSnap.exists() || pSnap.data().deleted || !pSnap.data().in_stock)
      return { ok: false, error: 'Product not available' };

    const p     = pSnap.data();
    const docId = cartDocId(product_id, size);
    const ref   = doc(db, 'users', u.uid, 'cart', docId);
    const snap  = await getDoc(ref);

    if (snap.exists()) {
      await updateDoc(ref, { qty: snap.data().qty + qty });
    } else {
      await setDoc(ref, {
        product_id,
        qty,
        size:      size || null,
        name:      p.name,
        price:     p.price,
        old_price: p.old_price || null,
        image:     p.image     || null,
        in_stock:  p.in_stock,
        icon:      p.icon      || '',
        added_at:  serverTimestamp(),
      });
    }
    return { ok: true, cart: await getCartLines(u.uid) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Mirrors: POST /api/cart.php  action=update
 * Returns: { ok, cart[] }
 */
export async function apiCartUpdate({ product_id, qty, size = null }) {
  const u = auth.currentUser;
  if (!u) return { ok: false, error: 'Not logged in' };
  try {
    const docId = cartDocId(product_id, size);
    const ref   = doc(db, 'users', u.uid, 'cart', docId);
    if (qty <= 0) {
      await deleteDoc(ref);
    } else {
      await updateDoc(ref, { qty });
    }
    return { ok: true, cart: await getCartLines(u.uid) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Mirrors: POST /api/cart.php  action=remove
 * Returns: { ok, cart[] }
 */
export async function apiCartRemove({ product_id, size = null }) {
  const u = auth.currentUser;
  if (!u) return { ok: false, error: 'Not logged in' };
  try {
    const docId = cartDocId(product_id, size);
    await deleteDoc(doc(db, 'users', u.uid, 'cart', docId));
    return { ok: true, cart: await getCartLines(u.uid) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Mirrors: POST /api/cart.php  action=clear
 * Returns: { ok, cart[] }
 */
export async function apiCartClear() {
  const u = auth.currentUser;
  if (!u) return { ok: false, error: 'Not logged in' };
  try {
    const snap  = await getDocs(collection(db, 'users', u.uid, 'cart'));
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    return { ok: true, cart: [] };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ════════════════════════════════════════════════════════════
//  ORDERS  ( replaces /api/orders.php )
// ════════════════════════════════════════════════════════════

const TIER_DISCOUNTS = { Spoke: 5, Chain: 10, Peloton: 20 };

// ── MEMBERSHIP TIERS ───────────────────────────────────────────
// Spoke (free) < Chain < Peloton. `min_tier` on an event is the lowest tier
// allowed to join it: 'Spoke' = everyone, 'Chain' = Chain and up,
// 'Peloton' = Peloton only.
export const TIERS = ['Spoke', 'Chain', 'Peloton'];

/** Numeric rank of a tier — higher means a more exclusive tier. */
export function tierRank(tier) {
  const i = TIERS.indexOf(tier);
  return i === -1 ? 0 : i;
}

/** True when `tier` is at or above `minTier` (unknown tiers count as Spoke). */
export function tierAtLeast(tier, minTier) {
  return tierRank(tier) >= tierRank(minTier || 'Spoke');
}

/** Normalise a tier coming from a form or an old document. */
export function normaliseTier(tier) {
  return TIERS.includes(tier) ? tier : 'Spoke';
}

/** Human label for an event's tier gate. */
export function tierGateLabel(minTier) {
  const t = normaliseTier(minTier);
  if (t === 'Peloton') return 'Peloton members only';
  if (t === 'Chain')    return 'Chain & Peloton members only';
  return 'Open to all members';
}

/** The event's tier gate as a tier list, e.g. ['Spoke','Chain','Peloton']. */
export function allowedTiers(minTier) {
  const from = tierRank(minTier);
  return TIERS.filter((_, i) => i >= from);
}

/**
 * Stock change inside a transaction. Firestore requires every read in a
 * transaction to happen before any write, so this reads all the products
 * first and returns { shortages, apply }: call apply() once all reads are done.
 * sign -1 takes stock (checkout), +1 returns it (cancel). The same product in
 * two sizes is combined into one change.
 */
async function prepareStockChange(tx, items, sign) {
  const qtyById = {};
  items.forEach(i => { qtyById[i.product_id] = (qtyById[i.product_id] || 0) + (i.qty || 0); });
  const ids   = Object.keys(qtyById);
  const snaps = await Promise.all(ids.map(id => tx.get(doc(db, 'products', id))));

  const tracked   = snaps.filter(snap => snap.exists() && snap.data().stock_qty !== null && snap.data().stock_qty !== undefined);
  const shortages = sign < 0
    ? tracked.filter(snap => snap.data().stock_qty < qtyById[snap.id])
             .map(snap => `${snap.data().name} (only ${snap.data().stock_qty} left)`)
    : [];

  const apply = () => tracked.forEach(snap => {
    const newQty = Math.max(0, snap.data().stock_qty + sign * qtyById[snap.id]);
    tx.update(snap.ref, { stock_qty: newQty, in_stock: newQty > 0, updated_at: serverTimestamp() });
  });
  return { shortages, apply };
}

// ════════════════════════════════════════════════════════════
//  STOCK DEFAULTS — starting stock on hand per catalog sub-category
//  Used by the seed scripts and pre-filled in Admin → Add Product.
// ════════════════════════════════════════════════════════════

export const DEFAULT_STOCK = {
  'Mountain Bikes':                6,
  'Road & Gravel Bikes':           4,
  'Urban & Commuter Bikes':        8,
  'Drivetrain & Components':       20,
  'Safety & Rider Gear':           30,
  'On-Bike Storage & Maintenance': 25,
};
const DEFAULT_STOCK_BY_CATEGORY = { 'Built Bikes': 5, 'Bike Parts & Accessories': 20 };

/** Suggested starting stock for a product in this category / sub-category */
export function defaultStockFor(category, sub_category) {
  return DEFAULT_STOCK[sub_category] ?? DEFAULT_STOCK_BY_CATEGORY[category] ?? 10;
}

/**
 * List or fetch a single order for the current user.
 * Mirrors: GET /api/orders.php  and  GET /api/orders.php?id=
 * Returns: { ok, orders[] }  or  { ok, order }
 */
export async function apiOrdersGet({ id } = {}) {
  const u = auth.currentUser;
  if (!u) return { ok: false, error: 'Not logged in' };
  try {
    if (id) {
      const snap = await getDoc(doc(db, 'orders', id));
      if (!snap.exists() || snap.data().user_id !== u.uid)
        return { ok: false, error: 'Order not found' };
      const order = { id: snap.id, ...snap.data(), created_at: toISO(snap.data().created_at), updated_at: toISO(snap.data().updated_at) };
      order.items = await getOrderItems(id, snap.data());
      return { ok: true, order };
    }

    const snap = await getDocs(
      query(collection(db, 'orders'), where('user_id', '==', u.uid), orderBy('created_at', 'desc'))
    );
    const orders = await Promise.all(snap.docs.map(async d => ({
      id: d.id, ...d.data(),
      created_at: toISO(d.data().created_at), updated_at: toISO(d.data().updated_at),
      items: await getOrderItems(d.id, d.data()),
    })));
    return { ok: true, orders };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Place an order from the user's cart.
 * Mirrors: POST /api/orders.php  action=place
 * Returns: { ok, order_id, total, discount_pct }
 */
export async function apiOrderPlace({ promo_code = '', pickup_date = '', pickup_time = '', pickup_notes = '', payment_method = 'cash' } = {}) {
  const u = auth.currentUser;
  if (!u) return { ok: false, error: 'Not logged in' };
  try {
    // Get user profile for tier
    const userSnap = await getDoc(doc(db, 'users', u.uid));
    if (!userSnap.exists()) return { ok: false, error: 'User not found' };
    const userData = userSnap.data();

    // Get cart
    const cartSnap = await getDocs(collection(db, 'users', u.uid, 'cart'));
    if (cartSnap.empty) return { ok: false, error: 'Cart is empty' };
    const cart = cartSnap.docs.map(d => ({ _docId: d.id, ...d.data() }));

    // Tier discount
    // Tier discount as set in Admin → Membership Tiers (defaults if never saved)
    const { settings } = await apiSettingsGet();
    let discPct = settings[`tier_discount_${userData.tier}`] ?? TIER_DISCOUNTS[userData.tier] ?? 0;

    // Promo code (takes precedence if higher)
    if (promo_code) {
      const code = promo_code.toUpperCase().trim();
      const promoSnap = await getDoc(doc(db, 'promo_codes', code));
      if (promoSnap.exists() && promoSnap.data().active) {
        const promoDisc = promoSnap.data().discount || 0;
        if (promoDisc > discPct) discPct = promoDisc;
      }
    }

    const subtotal = cart.reduce((s, l) => s + (l.price * l.qty), 0);
    const total    = Math.round(subtotal * (1 - discPct / 100) * 100) / 100;
    const orderId  = makeOrderId();

    // Firestore transaction: write order + decrement stock + clear cart
    await runTransaction(db, async (tx) => {
      // Reads first: current stock for every product in the cart
      const stock = await prepareStockChange(tx, cart, -1);
      if (stock.shortages.length) throw new Error('Not enough stock: ' + stock.shortages.join(', '));

      // Writes: decrement stock for tracked products
      stock.apply();

      // Write order document (lines + customer copied in so lists need no extra reads)
      const orderRef = doc(db, 'orders', orderId);
      tx.set(orderRef, {
        user_id:       u.uid,
        guest_email:   null,
        customer_name:  userData.name || `${userData.first_name} ${userData.last_name}`,
        customer_email: userData.email || '',
        tier:           userData.tier || 'Spoke',
        items:          cart.map(l => ({ product_id: l.product_id, name: l.name, price: l.price, qty: l.qty, size: l.size || null })),
        item_count:     cart.reduce((n, l) => n + l.qty, 0),
        discount_pct:   discPct,
        subtotal,
        total,
        payment_method: (payment_method === 'online' ? 'paymongo' : 'cash'),
        payment_status: 'pending',   // the payment server (MongoDB) records whether it was paid
        status:         'reserved',
        pickup_date:   pickup_date  || null,
        pickup_time:   pickup_time  || null,
        pickup_notes:  pickup_notes || null,
        created_at:    serverTimestamp(),
        updated_at:    serverTimestamp(),
      });

      // Write order items as sub-collection
      for (const line of cart) {
        const itemRef = doc(collection(db, 'orders', orderId, 'items'));
        tx.set(itemRef, {
          product_id: line.product_id,
          name:       line.name,
          price:      line.price,
          qty:        line.qty,
          size:       line.size || null,
        });
      }

      // Clear cart items
      for (const line of cart) {
        tx.delete(doc(db, 'users', u.uid, 'cart', line._docId));
      }
    });

    return { ok: true, order_id: orderId, total, discount_pct: discPct };
  } catch (e) {
    return { ok: false, error: 'Could not place order: ' + e.message };
  }
}

/**
 * Cancel a reserved order.
 * Mirrors: POST /api/orders.php  action=cancel
 * Returns: { ok }
 */
export async function apiOrderCancel({ order_id }) {
  const u = auth.currentUser;
  if (!u) return { ok: false, error: 'Not logged in' };
  if (!order_id) return { ok: false, error: 'order_id required' };
  try {
    const orderRef  = doc(db, 'orders', order_id);
    const orderSnap = await getDoc(orderRef);
    if (!orderSnap.exists() || orderSnap.data().user_id !== u.uid)
      return { ok: false, error: 'Order not found' };
    if (orderSnap.data().status !== 'reserved')
      return { ok: false, error: 'Only reserved orders can be cancelled' };

    // Items to restore stock for
    const items = await getOrderItems(order_id, orderSnap.data());

    await runTransaction(db, async (tx) => {
      const stock = await prepareStockChange(tx, items, +1);   // reads first
      tx.update(orderRef, { status: 'cancelled', updated_at: serverTimestamp() });
      stock.apply();                                           // restore stock
    });

    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'Could not cancel order: ' + e.message };
  }
}

// ════════════════════════════════════════════════════════════
//  EVENTS  ( replaces /api/events.php )
// ════════════════════════════════════════════════════════════

/**
 * List events and the current user's RSVP state.
 * Mirrors: GET /api/events.php
 * Returns: { ok, events[], my_rsvps[] }
 */
export async function apiEventsGet() {
  try {
    const snap   = await getDocs(
      query(collection(db, 'events'), where('deleted', '==', false), orderBy('event_date', 'asc'))
    );
    const events = snap.docs.map(d => ({
      id:          d.id,
      title:       d.data().title,
      kicker:      d.data().kicker,
      dist:        d.data().dist        || '',
      event_date:  d.data().event_date,
      description: d.data().description,
      capacity:    d.data().capacity,
      filled:      d.data().filled      || 0,
      is_vip:      d.data().is_vip      ? 1 : 0,
      featured:    d.data().featured    ? 1 : 0,
      // Map location (optional — set from the admin map picker)
      lat:         d.data().lat         ?? null,
      lng:         d.data().lng         ?? null,
      address:     d.data().address     || '',
      // Tier gate: the lowest membership tier allowed to join
      min_tier:    normaliseTier(d.data().min_tier),
    }));

    let myRsvps = [];
    let myTier  = null;
    const u = auth.currentUser;
    if (u) {
      const [rsvpSnap, meSnap] = await Promise.all([
        getDocs(query(collection(db, 'rsvps'), where('user_id', '==', u.uid))),
        getDoc(doc(db, 'users', u.uid)),
      ]);
      myRsvps = rsvpSnap.docs.map(d => d.data().event_id);
      myTier  = normaliseTier(meSnap.exists() ? meSnap.data().tier : 'Spoke');
    }

    events.forEach(ev => {
      ev.rsvpd      = myRsvps.includes(ev.id);
      ev.spots_left = Math.max(0, ev.capacity - ev.filled);
      // Tier gate — can this member join? null tier = signed out.
      ev.user_tier  = myTier;
      ev.can_join   = myTier === null ? false : tierAtLeast(myTier, ev.min_tier);
    });

    return { ok: true, events, my_rsvps: myRsvps, my_tier: myTier };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Toggle RSVP for an event.
 * Mirrors: POST /api/events.php  action=rsvp
 * Returns: { ok, rsvpd }
 */
export async function apiEventRsvp({ event_id }) {
  const u = auth.currentUser;
  if (!u) return { ok: false, error: 'Login required to RSVP' };
  if (!event_id) return { ok: false, error: 'event_id required' };
  try {
    const eventRef  = doc(db, 'events', event_id);
    const eventSnap = await getDoc(eventRef);
    if (!eventSnap.exists() || eventSnap.data().deleted)
      return { ok: false, error: 'Event not found' };

    const rsvpId  = `${u.uid}_${event_id}`;
    const rsvpRef = doc(db, 'rsvps', rsvpId);
    const rsvpSnap = await getDoc(rsvpRef);

    // The count is read inside the transaction, so two people tapping at once can't overfill it
    if (rsvpSnap.exists()) {
      // Remove RSVP
      await runTransaction(db, async (tx) => {
        const ev = (await tx.get(eventRef)).data();
        tx.delete(rsvpRef);
        tx.update(eventRef, { filled: Math.max(0, (ev.filled || 0) - 1) });
      });
      return { ok: true, rsvpd: false };
    } else {
      // Add RSVP — check the tier gate and capacity
      const meSnap = await getDoc(doc(db, 'users', u.uid));
      const myTier = normaliseTier(meSnap.exists() ? meSnap.data().tier : 'Spoke');
      const minTier = normaliseTier(eventSnap.data().min_tier);

      if (!tierAtLeast(myTier, minTier)) {
        return {
          ok: false,
          error: minTier === 'Peloton'
            ? 'This event is exclusive to Peloton members.'
            : 'This event is for Chain members and above.',
        };
      }

      const full = await runTransaction(db, async (tx) => {
        const ev = (await tx.get(eventRef)).data();
        if ((ev.filled || 0) >= ev.capacity) return true;
        tx.set(rsvpRef, { user_id: u.uid, event_id, created_at: serverTimestamp() });
        tx.update(eventRef, { filled: (ev.filled || 0) + 1 });
        return false;
      });
      if (full) return { ok: false, error: 'This event is full' };
      return { ok: true, rsvpd: true };
    }
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ════════════════════════════════════════════════════════════
//  WISHLIST  ( replaces /api/wishlist.php )
// ════════════════════════════════════════════════════════════

/**
 * Get wishlist.
 * Mirrors: GET /api/wishlist.php
 * Returns: { ok, wishlist[] }
 */
export async function apiWishlistGet() {
  const u = auth.currentUser;
  if (!u) return { ok: false, error: 'Not logged in', wishlist: [] };
  try {
    const snap = await getDocs(
      query(collection(db, 'wishlists'), where('user_id', '==', u.uid), orderBy('added_at', 'desc'))
    );
    const wishlist = [];
    for (const d of snap.docs) {
      const pid   = d.data().product_id;
      const pSnap = await getDoc(doc(db, 'products', pid));
      if (pSnap.exists()) {
        wishlist.push({
          product_id: pid,
          name:       pSnap.data().name,
          price:      pSnap.data().price,
          image:      pSnap.data().image  || null,
          icon:       pSnap.data().icon   || '',
          in_stock:   pSnap.data().in_stock,
        });
      }
    }
    return { ok: true, wishlist };
  } catch (e) {
    return { ok: false, error: e.message, wishlist: [] };
  }
}

/**
 * Toggle wishlist item.
 * Mirrors: POST /api/wishlist.php  action=toggle
 * Returns: { ok, in_wishlist }
 */
export async function apiWishlistToggle({ product_id }) {
  const u = auth.currentUser;
  if (!u) return { ok: false, error: 'Not logged in' };
  if (!product_id) return { ok: false, error: 'product_id required' };
  try {
    const wId  = `${u.uid}_${product_id}`;
    const wRef = doc(db, 'wishlists', wId);
    const wSnap = await getDoc(wRef);
    if (wSnap.exists()) {
      await deleteDoc(wRef);
      return { ok: true, in_wishlist: false };
    } else {
      await setDoc(wRef, { user_id: u.uid, product_id, added_at: serverTimestamp() });
      return { ok: true, in_wishlist: true };
    }
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ════════════════════════════════════════════════════════════
//  PROMO CODES  ( replaces /api/promo.php )
// ════════════════════════════════════════════════════════════

/**
 * Validate a promo code.
 * Mirrors: POST /api/promo.php
 * Returns: { ok, code, discount }
 */
export async function apiPromo({ code }) {
  if (!code) return { ok: false, error: 'No code provided' };
  try {
    const snap = await getDoc(doc(db, 'promo_codes', code.toUpperCase().trim()));
    if (snap.exists() && snap.data().active) {
      return { ok: true, code: snap.id, discount: snap.data().discount };
    }
    return { ok: false, error: 'Invalid or expired promo code' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ════════════════════════════════════════════════════════════
//  REVIEWS  ( replaces /api/review.php )
// ════════════════════════════════════════════════════════════

/**
 * Submit a product review.
 * Mirrors: POST /api/review.php
 * Returns: { ok }
 */
export async function apiReviewSubmit({ product_id, rating = 5, body }) {
  const u = auth.currentUser;
  if (!u) return { ok: false, error: 'Login required to leave a review' };
  if (!product_id) return { ok: false, error: 'product_id required' };
  if (!body)       return { ok: false, error: 'Review text required' };
  try {
    const pSnap = await getDoc(doc(db, 'products', product_id));
    if (!pSnap.exists() || pSnap.data().deleted)
      return { ok: false, error: 'Product not found' };

    const uSnap = await getDoc(doc(db, 'users', u.uid));
    const name  = uSnap.exists() ? (uSnap.data().name || uSnap.data().first_name) : 'Anonymous';

    await addDoc(collection(db, 'products', product_id, 'reviews'), {
      user_id:    u.uid,
      author:     `${name} — Verified`,
      rating:     Math.min(5, Math.max(1, rating)),
      body,
      created_at: serverTimestamp(),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ════════════════════════════════════════════════════════════
//  SUPPORT TICKETS  ( replaces /api/support.php )
// ════════════════════════════════════════════════════════════

/**
 * Submit a support ticket.
 * Only signed-in customers can open a ticket, and the reply address is the one
 * on the account — so nobody can make the shop mail an address they don't own.
 * Mirrors: POST /api/support.php
 * Returns: { ok, message }
 */
export async function apiSupportSubmit({ name, topic = 'General Inquiry', order_ref = '', message }) {
  const u = auth.currentUser;
  if (!u) return { ok: false, error: 'Please sign in to send a message.' };
  const to = (u.email || '').trim().toLowerCase();
  if (!to) return { ok: false, error: 'Your account has no email address. Please sign in again.' };
  if (!message) return { ok: false, error: 'Message is required' };
  const profile = await getCurrentUserDoc();
  const who = (name || '').trim()
           || profile?.name
           || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
           || to;
  try {
    const ref = await addDoc(collection(db, 'support_tickets'), {
      user_id:    u.uid,
      name:       who,
      email:      to,
      topic,
      order_ref:  order_ref || null,
      message,
      status:     'new',
      created_at: serverTimestamp(),
    });
    // Ticket is saved — emails are best-effort and never fail the submit
    const sent = await emailNewTicket({ id: ref.id, name: who, email: to, topic, order_ref, message });
    return { ok: true, message: sent.customer.ok
      ? `Your message has been received. A confirmation was sent to ${to}.`
      : 'Your message has been received. We will get back to you shortly.' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ════════════════════════════════════════════════════════════
//  ADMIN AUTH  ( replaces /admin/api/login.php, logout.php )
// ════════════════════════════════════════════════════════════

/**
 * Admin sign in. Checks the admins/{uid} document to verify admin role.
 * Mirrors: POST /admin/api/login.php
 * Returns: { ok, admin }
 */
export async function apiAdminLogin({ email, password }) {
  if (!email || !password) return { ok: false, error: 'Email and password are required' };
  try {
    const cred  = await signInWithEmailAndPassword(auth, email, password);
    const uid   = cred.user.uid;
    const snap  = await getDoc(doc(db, 'admins', uid));
    if (!snap.exists()) {
      await signOut(auth);
      return { ok: false, error: 'Invalid credentials' };
    }
    const data = snap.data();
    const words = (data.name || '').split(' ').filter(Boolean);
    const initials = words.map(w => w[0].toUpperCase()).join('');
    const admin = { id: uid, name: data.name, email: data.email, initials };
    return { ok: true, admin };
  } catch (e) {
    return { ok: false, error: 'Invalid credentials' };
  }
}

/**
 * Admin sign out.
 * Mirrors: POST /admin/api/logout.php
 */
export async function apiAdminLogout() {
  await signOut(auth);
  return { ok: true };
}

/**
 * Get current admin session.
 * Returns: { ok, admin } — admin null if not signed in as admin
 */
export async function apiAdminMe() {
  try {
    const data = await getCurrentAdminDoc();
    if (!data) return { ok: true, admin: null };
    const words    = (data.name || '').split(' ').filter(Boolean);
    const initials = words.map(w => w[0].toUpperCase()).join('');
    return { ok: true, admin: { id: data.uid, name: data.name, email: data.email, initials } };
  } catch (e) {
    return { ok: true, admin: null };
  }
}

// ════════════════════════════════════════════════════════════
//  ADMIN — DASHBOARD  ( replaces /admin/api/dashboard.php )
// ════════════════════════════════════════════════════════════

/**
 * Mirrors: GET /admin/api/dashboard.php
 * Returns: { ok, revenue, pending, active_members, low_stock,
 *             chart, recent_orders, top_products, activity }
 */
export async function apiAdminDashboard({ onlyOrderIds = null } = {}) {
  try {
    const [ordersSnap, membersSnap, productsSnap, msgsSnap] = await Promise.all([
      getDocs(collection(db, 'orders')),
      getDocs(query(collection(db, 'users'), where('status', '==', 'active'))),
      getDocs(query(collection(db, 'products'), where('deleted', '==', false))),
      getDocs(query(collection(db, 'support_tickets'), orderBy('created_at', 'desc'), limit(5))),
    ]);

    let orders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data(), _ts: d.data().created_at instanceof Timestamp ? d.data().created_at.toDate() : null }));
    // Admin can limit the dashboard to orders that have a real payment (paid or pending)
    const hidden = onlyOrderIds ? orders.filter(o => !onlyOrderIds.includes(o.id)).length : 0;
    if (onlyOrderIds) orders = orders.filter(o => onlyOrderIds.includes(o.id));
    const live   = orders.filter(o => o.status !== 'cancelled');
    const since  = days => new Date(Date.now() - days * 24 * 3600 * 1000);

    const revenue        = live.filter(o => o._ts && o._ts >= since(30)).reduce((s, o) => s + (o.total || 0), 0);
    // Open = not yet picked up or cancelled (reserved, preparing, awaiting pickup)
    const pending        = orders.filter(o => ['reserved', 'preparing', 'awaiting_pickup'].includes(o.status)).length;
    const active_members = membersSnap.size;
    const low_stock      = productsSnap.docs.filter(d => {
      const p = d.data();
      return !p.in_stock || (p.stock_qty !== null && p.stock_qty !== undefined && p.stock_qty <= 5);
    }).length;

    // 7-day chart (orders per day, by local date)
    const localDay = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const chart = {};
    for (let i = 6; i >= 0; i--) chart[localDay(since(i))] = 0;
    orders.forEach(o => { if (o._ts) { const day = localDay(o._ts); if (day in chart) chart[day]++; } });

    // Recent 8 orders, with customer names (stored on new orders; looked up for older ones)
    const recent  = [...orders].sort((a, b) => (b._ts || 0) - (a._ts || 0)).slice(0, 8);
    const missing = recent.filter(o => o.user_id && !o.customer_name).map(o => o.user_id);
    const users   = missing.length ? await getUsersById(missing) : {};
    const recent_orders = recent.map(o => ({
      id: o.id, status: o.status, total: o.total, user_id: o.user_id,
      created_at:    o._ts ? localISO(o._ts) : null,
      customer_name: o.customer_name || users[o.user_id]?.name || o.guest_email || 'Guest',
      tier:          o.tier || users[o.user_id]?.tier || null,
    }));

    // Top 5 products by units sold
    const itemLists = await Promise.all(live.map(o => getOrderItems(o.id, o)));
    const unitMap = {}, nameMap = {};
    itemLists.flat().forEach(({ product_id, name, qty }) => {
      unitMap[product_id] = (unitMap[product_id] || 0) + (qty || 0);
      nameMap[product_id] = name;
    });
    const top_products = Object.entries(unitMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pid, units]) => ({ product_id: pid, name: nameMap[pid], units }));

    // Activity feed
    const activity = [
      ...recent_orders.map(o => ({ type: 'order', ref: o.id, status: o.status, actor: o.customer_name, ts: o.created_at })),
      ...msgsSnap.docs.map(d => ({ type: 'message', ref: `#${d.id.slice(0, 6)}`, status: d.data().status, actor: d.data().name, ts: toISO(d.data().created_at) })),
    ].sort((a, b) => (b.ts || '').localeCompare(a.ts || '')).slice(0, 10);

    return { ok: true, revenue, pending, active_members, low_stock, chart, recent_orders, top_products, activity, hidden };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ════════════════════════════════════════════════════════════
//  ADMIN — ORDERS  ( replaces /admin/api/orders.php )
// ════════════════════════════════════════════════════════════

/**
 * Mirrors: GET /admin/api/orders.php  (list + single)
 */
export async function apiAdminOrdersGet({ id, status: statusFilter, q } = {}) {
  try {
    if (id) {
      const snap = await getDoc(doc(db, 'orders', id));
      if (!snap.exists()) return { ok: false, error: 'Not found' };
      const data  = snap.data();
      const order = { id: snap.id, ...data, created_at: toISO(data.created_at) };
      const [items, users] = await Promise.all([
        getOrderItems(id, data),
        data.user_id && !data.customer_name ? getUsersById([data.user_id]) : Promise.resolve({}),
      ]);
      const u = users[data.user_id];
      order.items          = items;
      order.customer_name  = data.customer_name  || u?.name  || data.guest_email || 'Guest';
      order.customer_email = data.customer_email || u?.email || data.guest_email || '';
      order.tier           = data.tier || u?.tier || null;
      return { ok: true, order };
    }

    let constraints = [orderBy('created_at', 'desc'), limit(500)];
    if (statusFilter) constraints = [where('status', '==', statusFilter), ...constraints];
    const snap = await getDocs(query(collection(db, 'orders'), ...constraints));

    // Older orders (before the speed-up) need their customer and lines looked up
    const docs    = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const users   = await getUsersById(docs.filter(o => o.user_id && !o.customer_name).map(o => o.user_id));
    const counts  = await Promise.all(docs.map(async o =>
      typeof o.item_count === 'number' ? o.item_count : (await getOrderItems(o.id, o)).reduce((s, i) => s + (i.qty || 0), 0)));

    const orders = docs.map((o, i) => {
      const u = users[o.user_id];
      return {
        ...o,
        created_at:     toISO(o.created_at),
        customer_name:  o.customer_name  || u?.name  || o.guest_email || 'Guest',
        customer_email: o.customer_email || u?.email || o.guest_email || '',
        tier:           o.tier || u?.tier || null,
        item_count:     counts[i],
      };
    });

    const lq = (q || '').toLowerCase();
    const filtered = lq
      ? orders.filter(o =>
          o.id.toLowerCase().includes(lq) ||
          (o.customer_name || '').toLowerCase().includes(lq) ||
          (o.customer_email || '').toLowerCase().includes(lq))
      : orders;

    return { ok: true, orders: filtered };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Update order status (with stock adjustment).
 * Mirrors: POST /admin/api/orders.php  action=status
 */
export async function apiAdminOrderStatus({ id, status }) {
  const allowed = ['reserved', 'preparing', 'awaiting_pickup', 'completed', 'cancelled'];
  if (!id || !allowed.includes(status)) return { ok: false, error: 'Invalid id or status' };
  try {
    const admin = await getCurrentAdminDoc();
    if (!admin) return { ok: false, error: 'Unauthorised' };

    const orderRef  = doc(db, 'orders', id);
    const orderSnap = await getDoc(orderRef);
    if (!orderSnap.exists()) return { ok: false, error: 'Order not found' };

    const currentStatus = orderSnap.data().status;
    const items         = await getOrderItems(id, orderSnap.data());

    // Cancelling returns stock; un-cancelling takes it again
    const sign = status === 'cancelled' && currentStatus !== 'cancelled' ? +1
               : currentStatus === 'cancelled' && status !== 'cancelled' ? -1
               : 0;

    await runTransaction(db, async (tx) => {
      const stock = sign ? await prepareStockChange(tx, items, sign) : null;   // reads first
      if (stock && stock.shortages.length) throw new Error('Not enough stock to restore this order: ' + stock.shortages.join(', '));
      tx.update(orderRef, { status, updated_at: serverTimestamp() });
      if (stock) stock.apply();
    });

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ════════════════════════════════════════════════════════════
//  ADMIN — CUSTOMERS  ( replaces /admin/api/customers.php )
// ════════════════════════════════════════════════════════════

/**
 * Mirrors: GET /admin/api/customers.php
 */
export async function apiAdminCustomersGet({ q, tier } = {}) {
  try {

    let constraints = [orderBy('created_at', 'desc'), limit(500)];
    if (tier) constraints = [where('tier', '==', tier), ...constraints];

    const [snap, allOrders] = await Promise.all([
      getDocs(query(collection(db, 'users'), ...constraints)),
      getDocs(query(collection(db, 'orders'), where('status', '!=', 'cancelled'))),
    ]);
    const users = snap.docs.map(d => ({ id: d.id, ...d.data(), created_at: toISO(d.data().created_at) }));

    // Client-side search
    const filtered = q
      ? users.filter(u =>
          (u.name || '').toLowerCase().includes(q.toLowerCase())   ||
          (u.email || '').toLowerCase().includes(q.toLowerCase())  ||
          (u.first_name || '').toLowerCase().includes(q.toLowerCase()) ||
          (u.last_name  || '').toLowerCase().includes(q.toLowerCase())
        )
      : users;

    // Order stats per user
    const statsByUser = {};
    allOrders.docs.forEach(d => {
      const uid = d.data().user_id;
      if (!uid) return;
      if (!statsByUser[uid]) statsByUser[uid] = { order_count: 0, total_spend: 0 };
      statsByUser[uid].order_count++;
      statsByUser[uid].total_spend += d.data().total || 0;
    });
    filtered.forEach(u => {
      const s = statsByUser[u.id] || { order_count: 0, total_spend: 0 };
      u.order_count = s.order_count;
      u.total_spend = s.total_spend;
    });

    // Tier counts
    const tierMap = {};
    snap.docs.forEach(d => {
      const t = d.data().tier || 'Spoke';
      tierMap[t] = (tierMap[t] || 0) + 1;
    });
    const tier_counts = Object.entries(tierMap).map(([tier, cnt]) => ({ tier, cnt }));

    return { ok: true, customers: filtered, tier_counts };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Change a customer's membership tier (paid tiers are activated in-store).
 * Returns: { ok }
 */
export async function apiAdminCustomerTier({ id, tier }) {
  if (!id || !['Spoke', 'Chain', 'Peloton'].includes(tier)) return { ok: false, error: 'Invalid request' };
  try {
    const admin = await getCurrentAdminDoc();
    if (!admin) return { ok: false, error: 'Unauthorised' };
    await updateDoc(doc(db, 'users', id), { tier });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Update customer status (active / suspended).
 * Mirrors: POST /admin/api/customers.php  action=status
 */
export async function apiAdminCustomerStatus({ id, status }) {
  if (!id || !['active', 'suspended'].includes(status))
    return { ok: false, error: 'Invalid request' };
  try {
    const admin = await getCurrentAdminDoc();
    if (!admin) return { ok: false, error: 'Unauthorised' };
    await updateDoc(doc(db, 'users', id), { status });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ════════════════════════════════════════════════════════════
//  ADMIN — PRODUCTS  ( replaces /admin/api/products.php )
// ════════════════════════════════════════════════════════════

/**
 * Mirrors: GET /admin/api/products.php
 */
export async function apiAdminProductsGet({ q, cat, stock } = {}) {
  try {

    let constraints = [where('deleted', '==', false), orderBy('category'), orderBy('name')];

    const snap = await getDocs(query(collection(db, 'products'), ...constraints));
    let products = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (cat)   products = products.filter(p => p.category === cat);
    if (q)     products = products.filter(p =>
      (p.name || '').toLowerCase().includes(q.toLowerCase()) ||
      (p.brand || '').toLowerCase().includes(q.toLowerCase())
    );
    if (stock === 'in')  products = products.filter(p => p.in_stock && (p.stock_qty === null || p.stock_qty === undefined || p.stock_qty > 5));
    if (stock === 'low') products = products.filter(p => p.in_stock && p.stock_qty !== null && p.stock_qty !== undefined && p.stock_qty >= 1 && p.stock_qty <= 5);
    if (stock === 'out') products = products.filter(p => !p.in_stock);

    const categories = [...new Set(products.map(p => p.category))].sort();

    return { ok: true, products, categories };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Save (add or update) a product.
 * Mirrors: POST /admin/api/products.php  action=save
 * Note: Image upload is not handled — pass a URL/path string for image.
 */
export async function apiAdminProductSave(data) {
  try {
    const admin = await getCurrentAdminDoc();
    if (!admin) return { ok: false, error: 'Unauthorised' };

    const { id, name, brand, category, sub_category, price, old_price = null,
            in_stock = true, stock_qty = null, tag = '', short_desc = '',
            description = '', image = null, specs = '[]', sizes = null, default_size = null } = data;

    if (!name || !brand || !category || !sub_category || !price)
      return { ok: false, error: 'Name, brand, category, sub-category and price are required' };

    const qty = stock_qty !== '' && stock_qty !== null && stock_qty !== undefined ? parseInt(stock_qty) : null;
    if (qty !== null && (isNaN(qty) || qty < 0)) return { ok: false, error: 'Stock must be 0 or more' };

    const payload = {
      name, brand, category, sub_category,
      price:        parseFloat(price),
      old_price:    old_price ? parseFloat(old_price) : null,
      in_stock:     Boolean(in_stock) && (qty === null || qty > 0),   // 0 on hand = not purchasable
      stock_qty:    qty,
      tag,
      short_desc,
      description,
      image:        image || null,
      specs:        typeof specs === 'string' ? specs : JSON.stringify(specs || []),   // nested arrays aren't allowed in Firestore
      sizes:        sizes ? (typeof sizes === 'string' ? JSON.parse(sizes) : sizes) : null,
      default_size: default_size || null,
      deleted:      false,
      updated_at:   serverTimestamp(),
    };

    if (id) {
      await updateDoc(doc(db, 'products', id), payload);
      return { ok: true, id };
    } else {
      const slug = `custom-${slugify(name).slice(0, 30)}-${Date.now().toString(36)}`;
      payload.icon       = '🚲';
      payload.created_at = serverTimestamp();
      await setDoc(doc(db, 'products', slug), payload);
      return { ok: true, id: slug };
    }
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Soft-delete a product.
 * Mirrors: POST /admin/api/products.php  action=delete
 */
export async function apiAdminProductDelete({ id }) {
  if (!id) return { ok: false, error: 'id required' };
  try {
    const admin = await getCurrentAdminDoc();
    if (!admin) return { ok: false, error: 'Unauthorised' };
    await updateDoc(doc(db, 'products', id), { deleted: true, updated_at: serverTimestamp() });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ════════════════════════════════════════════════════════════
//  ADMIN — STOCK  ( replaces /admin/api/stock.php )
// ════════════════════════════════════════════════════════════

/**
 * Mirrors: GET /admin/api/stock.php
 */
export async function apiAdminStockGet({ level, q } = {}) {
  try {

    const snap = await getDocs(query(collection(db, 'products'), where('deleted', '==', false)));
    let products = snap.docs.map(d => ({
      id: d.id,
      name:         d.data().name,
      brand:        d.data().brand,
      category:     d.data().category,
      sub_category: d.data().sub_category,
      image:        d.data().image  || null,
      icon:         d.data().icon   || '',
      in_stock:     d.data().in_stock,
      stock_qty:    d.data().stock_qty !== undefined ? d.data().stock_qty : null,
    }));

    if (level === 'out')  products = products.filter(p => !p.in_stock);
    if (level === 'low')  products = products.filter(p => p.in_stock && p.stock_qty !== null && p.stock_qty !== undefined && p.stock_qty >= 0 && p.stock_qty <= 5);
    if (level === 'ok')   products = products.filter(p => p.in_stock && (p.stock_qty === null || p.stock_qty === undefined || p.stock_qty > 5));

    if (q) {
      const lq = q.toLowerCase();
      products = products.filter(p =>
        (p.name || '').toLowerCase().includes(lq)         ||
        (p.brand || '').toLowerCase().includes(lq)        ||
        (p.sub_category || '').toLowerCase().includes(lq)
      );
    }

    // Sort: out first, then low, then ok
    products.sort((a, b) => {
      const rank = p => !p.in_stock ? 0 : (p.stock_qty !== null && p.stock_qty !== undefined && p.stock_qty <= 5 ? 1 : 2);
      return rank(a) - rank(b) || a.name.localeCompare(b.name);
    });

    const all = snap.docs.map(d => d.data());
    const counts = {
      out_of_stock: all.filter(p => !p.in_stock).length,
      low_stock:    all.filter(p => p.in_stock && p.stock_qty !== null && p.stock_qty !== undefined && p.stock_qty >= 0 && p.stock_qty <= 5).length,
      in_stock:     all.filter(p => p.in_stock && (p.stock_qty === null || p.stock_qty === undefined || p.stock_qty > 5)).length,
      total:        all.length,
    };

    return { ok: true, products, counts };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Update a single product's stock.
 * Mirrors: POST /admin/api/stock.php  action=update
 */
export async function apiAdminStockUpdate({ id, in_stock, stock_qty }) {
  if (!id) return { ok: false, error: 'id required' };
  try {
    const admin = await getCurrentAdminDoc();
    if (!admin) return { ok: false, error: 'Unauthorised' };
    const updates = { updated_at: serverTimestamp() };
    if (in_stock !== undefined) updates.in_stock = Boolean(in_stock);
    if (stock_qty !== undefined) updates.stock_qty = stock_qty !== null && stock_qty !== '' ? parseInt(stock_qty) : null;
    if (updates.stock_qty === 0) updates.in_stock = false;   // 0 on hand = not purchasable
    await updateDoc(doc(db, 'products', id), updates);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Bulk update stock for multiple products.
 * Mirrors: POST /admin/api/stock.php  action=bulk
 */
export async function apiAdminStockBulk({ items }) {
  if (!items || !items.length) return { ok: false, error: 'No items provided' };
  try {
    const admin = await getCurrentAdminDoc();
    if (!admin) return { ok: false, error: 'Unauthorised' };
    const batch = writeBatch(db);
    items.forEach(item => {
      if (!item.id) return;
      const stock_qty = item.stock_qty !== null && item.stock_qty !== '' ? parseInt(item.stock_qty) : null;
      batch.update(doc(db, 'products', item.id), {
        in_stock:   Boolean(item.in_stock) && stock_qty !== 0,   // 0 on hand = not purchasable
        stock_qty,
        updated_at: serverTimestamp(),
      });
    });
    await batch.commit();
    return { ok: true, updated: items.length };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ════════════════════════════════════════════════════════════
//  ADMIN — EVENTS  ( replaces /admin/api/events.php )
// ════════════════════════════════════════════════════════════

/**
 * Mirrors: GET /admin/api/events.php
 */
export async function apiAdminEventsGet() {
  try {
    const snap   = await getDocs(
      query(collection(db, 'events'), where('deleted', '==', false), orderBy('event_date', 'asc'))
    );
    const events = snap.docs.map(d => ({ id: d.id, ...d.data(), rsvp_count: d.data().filled || 0 }));
    return { ok: true, events };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Add or update an event.
 * Mirrors: POST /admin/api/events.php  action=save
 */
export async function apiAdminEventSave(data) {
  try {
    const admin = await getCurrentAdminDoc();
    if (!admin) return { ok: false, error: 'Unauthorised' };

    const { id, title, kicker, dist = '', event_date, description = '',
            capacity = 50, filled = 0, is_vip = false, featured = false,
            lat = null, lng = null, address = null, min_tier = 'Spoke' } = data;

    if (!title || !kicker || !event_date)
      return { ok: false, error: 'Title, kicker and date are required' };

    const payload = {
      title, kicker, dist, event_date, description,
      capacity: parseInt(capacity),
      filled:   parseInt(filled),
      is_vip:   Boolean(is_vip),
      featured: Boolean(featured),
      deleted:  false,
      // Location fields (optional)
      lat: lat !== null && lat !== '' ? Number(lat) : null,
      lng: lng !== null && lng !== '' ? Number(lng) : null,
      address: address || null,
      // Who may join: 'Spoke' = everyone, 'Chain' = Chain and up, 'Peloton' = Peloton only
      min_tier: normaliseTier(min_tier)
    };

    if (id) {
      await updateDoc(doc(db, 'events', id), payload);
      return { ok: true, id };
    } else {
      const newId = `evt-${slugify(title).slice(0, 30)}-${Date.now().toString(36)}`;
      payload.created_at = serverTimestamp();
      await setDoc(doc(db, 'events', newId), payload);
      return { ok: true, id: newId };
    }
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Soft-delete an event.
 * Mirrors: POST /admin/api/events.php  action=delete
 */
export async function apiAdminEventDelete({ id }) {
  if (!id) return { ok: false, error: 'id required' };
  try {
    const admin = await getCurrentAdminDoc();
    if (!admin) return { ok: false, error: 'Unauthorised' };
    await updateDoc(doc(db, 'events', id), { deleted: true });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ════════════════════════════════════════════════════════════
//  ADMIN — MESSAGES  ( replaces /admin/api/messages.php )
// ════════════════════════════════════════════════════════════

/**
 * Mirrors: GET /admin/api/messages.php
 */
export async function apiAdminMessagesGet({ status: statusFilter, q } = {}) {
  try {

    let constraints = [orderBy('created_at', 'desc'), limit(300)];
    if (statusFilter) constraints = [where('status', '==', statusFilter), ...constraints];

    const snap = await getDocs(query(collection(db, 'support_tickets'), ...constraints));
    let msgs = snap.docs.map(d => ({ id: d.id, ...d.data(), created_at: toISO(d.data().created_at) }));

    if (q) {
      const lq = q.toLowerCase();
      msgs = msgs.filter(m =>
        (m.name    || '').toLowerCase().includes(lq) ||
        (m.email   || '').toLowerCase().includes(lq) ||
        (m.topic   || '').toLowerCase().includes(lq) ||
        (m.message || '').toLowerCase().includes(lq)
      );
    }
    return { ok: true, messages: msgs };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Update ticket status.
 * Mirrors: POST /admin/api/messages.php  action=status
 */
export async function apiAdminMessageStatus({ id, status }) {
  if (!id || !['new', 'replied', 'resolved'].includes(status))
    return { ok: false, error: 'Invalid request' };
  try {
    const admin = await getCurrentAdminDoc();
    if (!admin) return { ok: false, error: 'Unauthorised' };
    await updateDoc(doc(db, 'support_tickets', id), { status });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Replies already sent on a ticket, oldest first.
 * Returns: { ok, replies[] }
 */
export async function apiAdminMessageReplies({ id }) {
  if (!id) return { ok: false, error: 'id required' };
  try {
    const snap = await getDocs(query(collection(db, 'support_tickets', id, 'replies'), orderBy('created_at', 'asc')));
    return { ok: true, replies: snap.docs.map(d => ({ id: d.id, ...d.data(), created_at: toISO(d.data().created_at) })) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Store an admin reply on a ticket.
 * Mirrors: POST /admin/api/messages.php  action=reply
 * In Firestore, replies go into a 'replies' sub-collection instead of
 * being concatenated into the message field.
 */
export async function apiAdminMessageReply({ id, reply }) {
  if (!id || !reply) return { ok: false, error: 'id and reply required' };
  try {
    const admin = await getCurrentAdminDoc();
    if (!admin) return { ok: false, error: 'Unauthorised' };
    await addDoc(collection(db, 'support_tickets', id, 'replies'), {
      reply,
      admin_name: admin.name,
      created_at: serverTimestamp(),
    });
    await updateDoc(doc(db, 'support_tickets', id), { status: 'replied' });
    // Also email the reply to the customer (best-effort: the reply is already
    // saved, so a failure here must not report an error and invite a resend)
    let emailed = false;
    try {
      const t = (await getDoc(doc(db, 'support_tickets', id))).data() || {};
      if (t.email) emailed = (await emailTicketReply({ id, name: t.name, email: t.email, topic: t.topic, reply, admin_name: admin.name })).ok;
    } catch (e) {
      console.warn('[email] reply email skipped', e.message);
    }
    return { ok: true, emailed };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ════════════════════════════════════════════════════════════
//  ADMIN — SETTINGS  ( replaces /admin/api/settings.php )
// ════════════════════════════════════════════════════════════

/**
 * Mirrors: GET /admin/api/settings.php
 */
export async function apiAdminSettingsGet() {
  try {
    const snap = await getDoc(doc(db, 'config', 'settings'));
    const settings = snap.exists() ? snap.data() : {
      tier_discount_Spoke:   5,
      tier_discount_Chain:   10,
      tier_discount_Peloton: 20,
    };
    return { ok: true, settings };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Public read of tier discounts for the storefront.
 * Returns: { ok, settings }
 */
export async function apiSettingsGet() {
  const defaults = { tier_discount_Spoke: 5, tier_discount_Chain: 10, tier_discount_Peloton: 20 };
  try {
    const snap = await getDoc(doc(db, 'config', 'settings'));
    return { ok: true, settings: snap.exists() ? { ...defaults, ...snap.data() } : defaults };
  } catch (e) {
    return { ok: true, settings: defaults };
  }
}

/**
 * Mirrors: POST /admin/api/settings.php  action=save
 */
export async function apiAdminSettingsSave({ tier_discount_Spoke, tier_discount_Chain, tier_discount_Peloton }) {
  try {
    const admin = await getCurrentAdminDoc();
    if (!admin) return { ok: false, error: 'Unauthorised' };
    await setDoc(doc(db, 'config', 'settings'), {
      tier_discount_Spoke:   Math.min(100, Math.max(0, parseInt(tier_discount_Spoke ?? 5))),
      tier_discount_Chain:   Math.min(100, Math.max(0, parseInt(tier_discount_Chain ?? 10))),
      tier_discount_Peloton: Math.min(100, Math.max(0, parseInt(tier_discount_Peloton ?? 20))),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ================================================================
//  MEMBERSHIP UPGRADE  (direct, paid)
// ================================================================
export async function apiMembershipUpgrade({ tier }) {
  const u = auth.currentUser;
  if (!u) return { ok: false, error: 'Not logged in' };
  if (!['Spoke', 'Chain', 'Peloton'].includes(tier))
    return { ok: false, error: 'Invalid tier' };
  try {
    await updateDoc(doc(db, 'users', u.uid), { tier, updated_at: serverTimestamp() });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
