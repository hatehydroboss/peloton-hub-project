const express = require('express');
const ctrl = require('../controllers/paymentController');
const { requireUser, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Customers (signed in)
router.post('/', requireUser, ctrl.createPayment);          // cash / pay at pickup
router.get('/mine', requireUser, ctrl.listMine);
router.get('/:id', requireUser, ctrl.getPayment);           // own payment (admins: any)

// Admins
router.get('/', requireAdmin, ctrl.listPayments);
router.patch('/:id', requireAdmin, ctrl.updatePayment);
router.post('/:id/refund', requireAdmin, ctrl.refundPayment);

module.exports = router;
