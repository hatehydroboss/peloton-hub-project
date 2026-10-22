const { Payment, PAYMENT_STATUSES } = require('../models/Payment');
const { getOrder, MEMBERSHIP_PRICE } = require('../services/orders');
const paymongo = require('../services/paymongo');
const { activateMembership } = require('../services/firestoreAdmin');

function toDTO(p) {
  return {
    id: p._id,
    paymentId: p.paymentId,
    orderId: p.orderId,
    userId: p.userId,
    type: p.type,
    amount: p.amount,
    currency: p.currency,
    method: p.method,
    status: p.status,
    provider: p.provider,
    transactionRef: p.transactionRef,
    metadata: p.metadata,
    paidAt: p.paidAt,
    refundedAt: p.refundedAt,
    refundReason: p.refundReason,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function fail(res, status, error) { return res.status(status).json({ ok: false, error }); }

// Pages PayMongo may send the customer back to (website, Android app, local testing)
const RETURN_ORIGINS = (process.env.APP_URLS || 'https://pelotonhub.web.app,https://peletonhub.web.app,https://localhost,http://localhost:5500,http://127.0.0.1:5500')
  .split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean);

/**
 * Works out what is being paid for and how much — always from the server's side:
 * an order's total is read from Firestore, a membership uses the fixed price list.
 */
async function resolveCharge(req) {
  const { type = 'order', orderId, tier } = req.body || {};
  const asAdmin = req.user.isAdmin;
  if (type === 'membership') {
    if (!MEMBERSHIP_PRICE[tier]) return { error: [400, 'Choose Chain or Peloton'] };
    const userId = asAdmin && req.body.userId ? String(req.body.userId) : req.user.uid;
    return {
      type: 'membership', userId, amount: MEMBERSHIP_PRICE[tier],
      orderId: `MEM-${userId}-${Date.now()}`,
      description: `PelotonHub ${tier} membership (1 month)`,
      metadata: { type: 'membership', tier },
    };
  }
  if (!orderId) return { error: [400, 'orderId is required'] };
  const order = await getOrder(String(orderId), req.user.token);
  if (!order) return { error: [404, 'Order not found'] };
  if (order.userId !== req.user.uid && !asAdmin) return { error: [403, 'Not your order'] };
  if (order.status === 'cancelled') return { error: [400, 'This reservation was cancelled'] };
  return {
    type: 'order', userId: order.userId, amount: order.total, orderId: order.id,
    description: `PelotonHub reservation ${order.id}`,
    metadata: { type: 'order' },
    customer: { name: order.customerName, email: order.customerEmail || req.user.email },
  };
}

// POST /api/payments — record a cash / pay-at-pickup payment (pending until paid at the counter)
async function createPayment(req, res, next) {
  try {
    const charge = await resolveCharge(req);
    if (charge.error) return fail(res, ...charge.error);
    if (charge.type === 'order') {
      const existing = await Payment.findOne({ orderId: charge.orderId, status: { $in: ['pending', 'paid'] } });
      if (existing) return res.json({ ok: true, payment: toDTO(existing) });
    }
    // Only an admin may record a payment as already paid (e.g. cash received at the counter)
    const status = req.user.isAdmin && req.body.status === 'paid' ? 'paid' : 'pending';
    const payment = await Payment.create({
      orderId: charge.orderId, userId: charge.userId, type: charge.type, amount: charge.amount,
      method: req.body.method === 'cash' ? 'cash' : 'pay_at_pickup', status,
      provider: 'pelotonhub', metadata: { ...(req.body.metadata || {}), ...charge.metadata, activated: false },   // server's tier wins
    });
    await activateIfMembership(payment);   // admin recorded a cash membership as already paid
    return res.status(201).json({ ok: true, payment: toDTO(payment) });
  } catch (err) { next(err); }
}

// POST /api/paymongo/checkout — start an online payment on PayMongo's hosted page
async function createCheckout(req, res, next) {
  try {
    const charge = await resolveCharge(req);
    if (charge.error) return fail(res, ...charge.error);
    if (charge.amount < 20) return fail(res, 400, 'Online payment needs at least ₱20');
    const returnBase = String(req.body.returnBase || '').replace(/\/$/, '');
    if (!RETURN_ORIGINS.includes(returnBase)) return fail(res, 400, 'Unknown return address');
    if (charge.type === 'order') {
      const paid = await Payment.findOne({ orderId: charge.orderId, status: 'paid' });
      if (paid) return fail(res, 400, 'This reservation is already paid');
    }

    const payment = await Payment.create({
      orderId: charge.orderId, userId: charge.userId, type: charge.type, amount: charge.amount,
      method: 'paymongo', status: 'pending', provider: 'paymongo', metadata: charge.metadata,
    });
    const back = `${returnBase}/payment-result.html?payment=${payment._id}`;
    let session;
    try {
      session = await paymongo.createCheckoutSession({
        amount: charge.amount,
        description: charge.description,
        referenceNumber: payment.paymentId,
        successUrl: back,
        cancelUrl: back + '&cancelled=1',
        customer: charge.customer,
        metadata: { payment_id: String(payment._id), order_id: charge.orderId, type: charge.type },
      });
    } catch (err) {
      payment.status = 'failed';            // don't leave a pending payment that can never be paid
      payment.metadata = { ...payment.metadata, error: err.message };
      await payment.save();
      throw err;
    }
    payment.checkoutSessionId = session.id;
    payment.checkoutUrl = session.checkoutUrl;
    payment.transactionRef = session.id;
    await payment.save();
    return res.status(201).json({ ok: true, checkoutUrl: session.checkoutUrl, payment: toDTO(payment) });
  } catch (err) { next(err); }
}

// A paid membership switches the customer's tier on (once). A failure is kept on the
// payment and retried on the next check, and an admin can still switch it on by hand.
async function activateIfMembership(payment) {
  if (payment.type !== 'membership' || payment.status !== 'paid' || payment.metadata?.activated) return payment;
  let result;
  try { result = await activateMembership(payment.userId, payment.metadata?.tier, payment.paymentId); }
  catch (err) { result = { ok: false, error: err.message }; }
  if (!result.ok) console.error('[membership]', payment.paymentId, result.error);
  payment.metadata = { ...payment.metadata, activated: result.ok, activationError: result.ok ? null : result.error };
  payment.markModified('metadata');
  await payment.save();
  return payment;
}

async function markPaidFromSession(payment) {
  if (payment.status !== 'pending' || !payment.checkoutSessionId) return activateIfMembership(payment);
  const s = await paymongo.getCheckoutSession(payment.checkoutSessionId);
  if (s.paid) {
    payment.status = 'paid';
    payment.paymongoPaymentId = s.paymongoPaymentId;
    if (['gcash', 'paymaya', 'card', 'grab_pay', 'qrph'].includes(s.sourceType)) payment.method = s.sourceType;
    await payment.save();
  }
  return activateIfMembership(payment);
}

async function findOwned(req, res) {
  const payment = await Payment.findById(req.params.id).catch(() => null)
    || await Payment.findOne({ paymentId: req.params.id });
  if (!payment) { fail(res, 404, 'Payment not found'); return null; }
  if (payment.userId !== req.user.uid && !req.user.isAdmin) { fail(res, 403, 'Not your payment'); return null; }
  return payment;
}

// GET /api/paymongo/verify/:id — after returning from PayMongo: did it go through?
async function verifyCheckout(req, res, next) {
  try {
    const payment = await findOwned(req, res);
    if (!payment) return;
    await markPaidFromSession(payment);
    return res.json({ ok: true, payment: toDTO(payment) });
  } catch (err) { next(err); }
}

// POST /api/paymongo/webhook — PayMongo tells us a checkout was paid (works even if the customer closed the page)
async function webhook(req, res) {
  const raw = req.body instanceof Buffer ? req.body.toString('utf8') : '';
  if (!paymongo.verifyWebhook(raw, req.headers['paymongo-signature'], process.env.PAYMONGO_WEBHOOK_SECRET)) {
    return res.status(401).json({ ok: false });
  }
  try {
    const event = JSON.parse(raw).data.attributes;
    if (event.type === 'checkout_session.payment.paid') {
      const payment = await Payment.findOne({ checkoutSessionId: event.data.id });
      if (payment) await markPaidFromSession(payment);
    }
  } catch (err) { console.error('[webhook]', err.message); }
  return res.json({ ok: true });   // always 200 so PayMongo doesn't keep retrying a handled event
}

// GET /api/payments/mine — the signed-in customer's own payments
async function listMine(req, res, next) {
  try {
    const items = await Payment.find({ userId: req.user.uid }).sort({ createdAt: -1 }).limit(100);
    // Finish any membership that was paid but not switched on yet (e.g. the customer closed
    // PayMongo's page before coming back and no webhook arrived). The Profile page calls this.
    const recent = Date.now() - 3 * 24 * 3600 * 1000;
    for (const p of items) {
      if (p.type !== 'membership' || p.metadata?.activated) continue;
      if (p.status === 'paid') await activateIfMembership(p);
      else if (p.status === 'pending' && p.checkoutSessionId && p.createdAt >= recent) await markPaidFromSession(p).catch(() => {});
    }
    return res.json({ ok: true, payments: items.map(toDTO) });
  } catch (err) { next(err); }
}

// GET /api/payments — admin list (filters: orderId, status, userId)
async function listPayments(req, res, next) {
  try {
    const { orderId, status, userId, page = 1, limit = 100 } = req.query;
    const filter = {};
    if (orderId) filter.orderId = String(orderId).trim();
    if (status) filter.status = String(status).trim();
    if (userId) filter.userId = String(userId).trim();
    const take = Math.min(500, Math.max(1, Number(limit)));
    const skip = (Math.max(1, Number(page)) - 1) * take;
    const [items, total] = await Promise.all([
      Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(take),
      Payment.countDocuments(filter),
    ]);
    return res.json({ ok: true, payments: items.map(toDTO), total, page: Number(page), limit: take });
  } catch (err) { next(err); }
}

// GET /api/payments/:id — owner or admin
async function getPayment(req, res, next) {
  try {
    const payment = await findOwned(req, res);
    if (payment) return res.json({ ok: true, payment: toDTO(payment) });
  } catch (err) { next(err); }
}

// PATCH /api/payments/:id — admin: change status (e.g. cash received → paid)
async function updatePayment(req, res, next) {
  try {
    const payment = await Payment.findById(req.params.id).catch(() => null);
    if (!payment) return fail(res, 404, 'Payment not found');
    const { status, transactionRef } = req.body || {};
    if (status !== undefined) {
      if (!PAYMENT_STATUSES.includes(status) || status === 'refunded') return fail(res, 400, 'Invalid status (use Refund for refunds)');
      payment.status = status;
    }
    if (transactionRef !== undefined) payment.transactionRef = transactionRef;
    await payment.save();
    await activateIfMembership(payment);   // cash membership received at the counter
    return res.json({ ok: true, payment: toDTO(payment) });
  } catch (err) { next(err); }
}

// POST /api/payments/:id/refund — admin: refunds through PayMongo for online payments
async function refundPayment(req, res, next) {
  try {
    const payment = await Payment.findById(req.params.id).catch(() => null);
    if (!payment) return fail(res, 404, 'Payment not found');
    if (payment.status !== 'paid') return fail(res, 400, 'Only paid payments can be refunded');
    if (payment.paymongoPaymentId) {
      const refund = await paymongo.createRefund({
        paymongoPaymentId: payment.paymongoPaymentId, amount: payment.amount,
        notes: (req.body && req.body.reason) || 'Refunded by PelotonHub',
      });
      payment.paymongoRefundId = refund.id;
    }
    payment.status = 'refunded';
    payment.refundReason = (req.body && req.body.reason) || 'Refunded by admin';
    await payment.save();
    return res.json({ ok: true, payment: toDTO(payment) });
  } catch (err) { next(err); }
}

module.exports = {
  createPayment, createCheckout, verifyCheckout, webhook,
  listMine, listPayments, getPayment, updatePayment, refundPayment,
};
