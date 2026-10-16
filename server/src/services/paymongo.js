// PayMongo (https://developers.paymongo.com) — hosted checkout for GCash, Maya, cards, GrabPay.
// Uses the secret key from PAYMONGO_SECRET_KEY (sk_test_… for test mode, sk_live_… for real money).
const crypto = require('crypto');

const BASE = 'https://api.paymongo.com/v1';

function authHeader() {
  const key = process.env.PAYMONGO_SECRET_KEY;
  if (!key) {
    const err = new Error('Online payments are not set up yet (PAYMONGO_SECRET_KEY missing)');
    err.status = 503;
    throw err;
  }
  return 'Basic ' + Buffer.from(key + ':').toString('base64');
}

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('[paymongo]', method, path, res.status, JSON.stringify(json.errors || json).slice(0, 500));
    const detail = json.errors && json.errors[0] && (json.errors[0].detail || json.errors[0].code);
    const err = new Error('PayMongo: ' + (detail || `HTTP ${res.status}`));
    err.status = 502;
    throw err;
  }
  return json.data;
}

// Methods we'd like to offer; only the ones switched on for this PayMongo account are used
// (a new account may not have every method yet, and asking for one it lacks makes checkout fail).
const WANTED_METHODS = ['gcash', 'paymaya', 'card', 'grab_pay', 'qrph'];
let methodsCache = null;
async function availableMethods() {
  if (methodsCache && methodsCache.until > Date.now()) return methodsCache.list;
  let list;
  try {
    const res = await fetch(BASE + '/merchants/capabilities/payment_methods', {
      headers: { Authorization: authHeader(), Accept: 'application/json' },
    });
    const json = await res.json().catch(() => null);
    const enabled = Array.isArray(json) ? json : (json && Array.isArray(json.data) ? json.data : null);
    if (enabled) list = WANTED_METHODS.filter(m => enabled.includes(m));
    console.log('[paymongo] methods enabled for this account:', JSON.stringify(enabled));
  } catch (err) {
    console.error('[paymongo] could not read payment methods:', err.message);
  }
  if (!list || !list.length) list = ['gcash', 'card'];
  methodsCache = { list, until: Date.now() + 10 * 60 * 1000 };
  return list;
}

/** Create a hosted checkout page. amount is in pesos. */
async function createCheckoutSession({ amount, description, referenceNumber, successUrl, cancelUrl, customer, metadata }) {
  const attributes = {
    line_items: [{ currency: 'PHP', amount: Math.round(amount * 100), name: description, quantity: 1 }],
    payment_method_types: await availableMethods(),
    description,
    reference_number: referenceNumber,
    success_url: successUrl,
    cancel_url: cancelUrl,
    show_description: true,
    show_line_items: true,
    send_email_receipt: false,
    metadata,
  };
  if (customer && (customer.email || customer.name)) {
    attributes.billing = { email: customer.email || undefined, name: customer.name || undefined };
  }
  const data = await call('POST', '/checkout_sessions', { data: { attributes } });
  return { id: data.id, checkoutUrl: data.attributes.checkout_url };
}

/** Look up a checkout page: was it paid, and with what? */
async function getCheckoutSession(id) {
  const data = await call('GET', '/checkout_sessions/' + encodeURIComponent(id));
  const payments = data.attributes.payments || [];
  const paid = payments.find(p => p.attributes && p.attributes.status === 'paid');
  return {
    paid: !!paid,
    paymongoPaymentId: paid ? paid.id : null,
    sourceType: paid && paid.attributes.source ? paid.attributes.source.type : null,   // gcash, paymaya, card, grab_pay
  };
}

/** Refund a PayMongo payment (amount in pesos). */
async function createRefund({ paymongoPaymentId, amount, reason = 'requested_by_customer', notes }) {
  const data = await call('POST', '/refunds', {
    data: { attributes: { amount: Math.round(amount * 100), payment_id: paymongoPaymentId, reason, notes } },
  });
  return { id: data.id, status: data.attributes.status };
}

/** PayMongo signs every webhook: header "t=<time>,te=<test sig>,li=<live sig>". */
function verifyWebhook(rawBody, header, secret) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(',').map(kv => kv.split('=')));
  const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${rawBody}`).digest('hex');
  const given = parts.li || parts.te || '';
  return given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

module.exports = { createCheckoutSession, getCheckoutSession, createRefund, verifyWebhook };
