const express = require('express');
const router = express.Router();
const revolut = require('../src/revolut');
const store = require('../src/store');

// POST /api/create-deposit-order
// Body: { estimatedTotal, currency, customer:{name,email,phone}, dog:{name,breed},
//         service:{id,name,duration,price}, staff:{id,name}, date, time, notes }
router.post('/', async (req, res) => {
  try {
    const { estimatedTotal, currency, customer, dog, service, staff, date, time, notes } = req.body || {};

    if (!estimatedTotal || !customer || !customer.email || !customer.name || !dog || !service || !date || !time) {
      return res.status(400).json({ error: 'Missing required booking details.' });
    }

    // 50% deposit, rounded to whole cents.
    const depositAmount = Math.round(estimatedTotal * 50) / 100;
    const remainingBalance = Math.round((estimatedTotal - depositAmount) * 100) / 100;
    const amountMinorUnits = Math.round(depositAmount * 100); // Revolut expects minor units

    if (!process.env.FRONTEND_URL) {
      return res.status(500).json({ error: 'FRONTEND_URL is not configured on the server.' });
    }

    const order = await revolut.createOrder({
      amount: amountMinorUnits,
      currency: currency || 'EUR',
      email: customer.email,
      name: customer.name,
      description: `50% deposit — ${service.name} for ${dog.name}`,
      redirectUrl: `${process.env.FRONTEND_URL}?depositReturn=1`,
      metadata: { source: 'luxury-paws-booking' },
    });

    // Keyed by Revolut's own order id, so the webhook can look it straight up.
    store.saveOrder(order.id, {
      status: 'pending',
      estimatedTotal,
      depositAmount,
      remainingBalance,
      currency: currency || 'EUR',
      customer,
      dog,
      service,
      staff,
      date,
      time,
      notes,
    });

    res.json({
      orderId: order.id,
      checkoutUrl: order.checkout_url,
      depositAmount,
      remainingBalance,
      estimatedTotal,
    });
  } catch (err) {
    console.error('create-deposit-order error:', err);
    res.status(500).json({ error: 'Could not create deposit order. Please try again.' });
  }
});

module.exports = router;
