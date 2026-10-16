const express = require('express');
const ctrl = require('../controllers/paymentController');
const { requireUser } = require('../middleware/auth');

const router = express.Router();

router.post('/checkout', requireUser, ctrl.createCheckout);   // start an online payment
router.get('/verify/:id', requireUser, ctrl.verifyCheckout);  // check it after returning from PayMongo

module.exports = router;
