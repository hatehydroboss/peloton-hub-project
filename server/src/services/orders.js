// Reads an order from Firestore with the customer's own sign-in token, so the server
// charges the real order total (never an amount sent by the browser) and only for the
// customer's own order. Firestore's security rules decide what the token may read.
const { PROJECT_ID } = require('../middleware/auth');

const MEMBERSHIP_PRICE = { Chain: 499, Peloton: 999 };

function val(f) {
  if (!f) return null;
  if ('stringValue' in f) return f.stringValue;
  if ('integerValue' in f) return Number(f.integerValue);
  if ('doubleValue' in f) return f.doubleValue;
  if ('booleanValue' in f) return f.booleanValue;
  if ('nullValue' in f) return null;
  return null;
}

/** Returns { id, userId, total, status, customerName, customerEmail } or null if not found / not allowed. */
async function getOrder(orderId, idToken) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/orders/${encodeURIComponent(orderId)}`;
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + idToken } });
  if (!res.ok) return null;
  const doc = await res.json();
  const f = doc.fields || {};
  return {
    id: orderId,
    userId: val(f.user_id),
    total: Number(val(f.total)) || 0,
    status: val(f.status),
    customerName: val(f.customer_name),
    customerEmail: val(f.customer_email),
  };
}

module.exports = { getOrder, MEMBERSHIP_PRICE };
