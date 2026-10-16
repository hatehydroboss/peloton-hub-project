const mongoose = require('mongoose');

const PAYMENT_METHODS = ['cash', 'card', 'gcash', 'paymaya', 'grab_pay', 'bank_transfer', 'pay_at_pickup', 'online', 'paymongo'];
const PAYMENT_STATUSES = ['pending', 'authorized', 'paid', 'failed', 'refunded', 'cancelled'];

const paymentSchema = new mongoose.Schema(
  {
    paymentId: { type: String, unique: true, index: true },
    orderId: { type: String, required: true, index: true, trim: true },
    userId: { type: String, default: null, index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'PHP', trim: true },
    method: { type: String, enum: PAYMENT_METHODS, default: 'pay_at_pickup' },
    status: { type: String, enum: PAYMENT_STATUSES, default: 'pending', index: true },
    transactionRef: { type: String, default: null, trim: true },
    provider: { type: String, default: 'pelotonhub', trim: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    // What the payment is for: a store order (orderId = PH-…) or a membership upgrade
    type: { type: String, enum: ['order', 'membership'], default: 'order' },
    // PayMongo hosted checkout
    checkoutSessionId: { type: String, default: null, index: true },
    checkoutUrl: { type: String, default: null },
    paymongoPaymentId: { type: String, default: null },
    paymongoRefundId: { type: String, default: null },
    paidAt: { type: Date, default: null },
    refundedAt: { type: Date, default: null },
    refundReason: { type: String, default: null, trim: true },
  },
  { timestamps: true }
);

paymentSchema.index({ orderId: 1, status: 1 });

paymentSchema.pre('save', function (next) {
  if (!this.paymentId) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const suffix = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
    this.paymentId = `PAY-${date}-${suffix}`;
  }
  if (this.status === 'paid' && !this.paidAt) this.paidAt = new Date();
  if (this.status === 'refunded' && !this.refundedAt) this.refundedAt = new Date();
  next();
});

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = { Payment, PAYMENT_METHODS, PAYMENT_STATUSES };
