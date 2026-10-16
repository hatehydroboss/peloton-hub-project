require('dotenv').config();
const connectDB = require('./config/db');
const { Payment } = require('./models/Payment');

(async () => {
  await connectDB();
  const count = await Payment.countDocuments();
  if (count) {
    console.log(`[seed] ${count} payments already exist; skipping`);
    process.exit(0);
  }
  const samples = [
    { orderId: 'PH-20261015-0001', userId: 'demo-user', amount: 45999, method: 'pay_at_pickup', status: 'pending' },
    { orderId: 'PH-20261015-0002', userId: 'demo-user', amount: 1299, method: 'gcash', status: 'paid', transactionRef: 'GCASH-123' },
  ];
  for (const s of samples) await Payment.create(s);
  console.log('[seed] inserted sample payments');
  process.exit(0);
})();
