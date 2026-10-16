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
    const detail = json.errors && json.errors[0] && (json.errors[0].detail || json.errors[0].code);
    const err = new Error('PayMongo: ' + (detail || `HTTP ${res.status}`));
    err.status = 502;
    throw err;
  }
  return json.data;
}

/** Create a hosted checkout page. amount is in pesos. */
async function createCheckoutSession({ amount, description, referenceNumber, successUrl, cancelUrl, customer, metadata }) {
  const attributes = {
    line_items: [{ currency: 'PHP', amount: Math.round(amount * 100), name: description, quantity: 1 }],
    payment_method_types: ['gcash', 'paymaya', 'card', 'grab_pay'],
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
