const express = require('express');
const router = express.Router();
const store = require('../src/store');

// GET /api/order-status/:orderId
// Deliberately returns only what the frontend needs to finish the booking —
// never payment details, card info, or anything sensitive.
router.get('/:orderId', (req, res) => {
  const order = store.getOrder(req.params.orderId);
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  res.json({
    status: order.status, // 'pending' | 'paid' | 'paid_booking_failed' | 'failed'
    estimatedTotal: order.estimatedTotal,
    depositAmount: order.depositAmount,
    remainingBalance: order.remainingBalance,
    squareBookingId: order.squareBookingId || null,
  });
});

module.exports = router;
