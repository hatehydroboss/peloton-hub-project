// Client for the PelotonHub payment server (server/ — Node + MongoDB + PayMongo).
// Every request carries the signed-in user's Firebase ID token; the server checks it,
// reads the real order total itself and only lets admins list, mark paid or refund.
import { auth } from './firebase.js';

const isApp = !!window.Capacitor?.isNativePlatform?.();
const isLocal = !isApp && ['localhost', '127.0.0.1'].includes(location.hostname);

// The hosted server (Render). Running the site on your PC uses the local server instead.
const PRODUCTION_API = 'https://pelotonhub-payments.onrender.com/api';
const API_BASE = (window.PELOTON_PAYMENTS_API || (isLocal ? 'http://localhost:5000/api' : PRODUCTION_API)).replace(/\/$/, '');

// Where PayMongo sends the customer back after paying: this website, or the app's own pages
const RETURN_BASE = isApp ? 'https://localhost' : location.origin;

async function request(path, { method = 'GET', body } = {}) {
  const user = auth.currentUser;
  if (!user) return { ok: false, error: 'Please sign in first' };
  try {
    const res = await fetch(API_BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await user.getIdToken() },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) return { ok: false, error: data.error || `Payment server error (${res.status})` };
    return data;
  } catch {
    return { ok: false, error: 'Can’t reach the payment server. Check your connection and try again.' };
  }
}

/** The free server sleeps when idle; call this when a payment page opens so it's awake by checkout. */
export function wakePaymentServer() {
  fetch(API_BASE + '/health', { mode: 'cors' }).catch(() => {});
}

/** Cash / pay at pickup: recorded as pending until paid at the counter.
 *  { type:'order', orderId } or { type:'membership', tier } (admins may add userId, status:'paid') */
export function apiPaymentCreate(args) {
  return request('/payments', { method: 'POST', body: args });
}

/** Online: returns { ok, checkoutUrl } — send the customer to PayMongo's page. */
export function apiPaymongoCheckout(args) {
  return request('/paymongo/checkout', { method: 'POST', body: { ...args, returnBase: RETURN_BASE } });
}

/** After returning from PayMongo: { ok, payment } with status 'paid' once it went through. */
export function apiPaymongoVerify(id) {
  return request('/paymongo/verify/' + encodeURIComponent(id));
}

export function apiMyPayments() {
  return request('/payments/mine');
}

// ── Admin ──
export function apiAdminPayments({ status, orderId, limit } = {}) {
  const q = new URLSearchParams(Object.entries({ status, orderId, limit }).filter(([, v]) => v)).toString();
  return request('/payments' + (q ? '?' + q : ''));
}
export function apiAdminPaymentMarkPaid(id) {
  return request('/payments/' + encodeURIComponent(id), { method: 'PATCH', body: { status: 'paid' } });
}
export function apiAdminPaymentRefund(id, reason) {
  return request('/payments/' + encodeURIComponent(id) + '/refund', { method: 'POST', body: { reason } });
}

/** Go to PayMongo. In the app it opens inside the app and comes back to payment-result.html. */
export function goToCheckout(url) {
  window.phLoaderShow?.();
  location.href = url;
}

export { API_BASE };
