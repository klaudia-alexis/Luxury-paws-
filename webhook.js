const express = require('express');
const router = express.Router();
const revolut = require('../src/revolut');
const square = require('../src/square');
const store = require('../src/store');
const squareMapping = require('../src/square-mapping');

// POST /api/webhooks/revolut
// Mounted in server.js with express.raw() so we can verify the signature
// against the exact bytes Revolut sent, before anything parses the JSON.
router.post('/', async (req, res) => {
  const rawBody = req.body.toString('utf8');
  const signature = req.headers['revolut-signature'];
  const timestamp = req.headers['revolut-request-timestamp'];

  let valid = false;
  try {
    valid = revolut.verifyWebhookSignature(rawBody, signature, timestamp);
  } catch (err) {
    console.error('Webhook signature verification error:', err.message);
  }
  if (!valid) {
    console.warn('Rejected webhook with invalid/missing signature.');
    return res.status(401).send('Invalid signature');
  }

  // Acknowledge quickly — Revolut expects a fast 2xx and will retry otherwise.
  res.status(200).send('ok');

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (err) {
    console.error('Could not parse webhook body as JSON:', err.message);
    return;
  }

  const orderId = event.order_id;
  if (!orderId) return;

  const existing = store.getOrder(orderId);
  if (!existing) {
    // Not an order we created (or already cleaned up) — ignore.
    return;
  }

  if (event.event === 'ORDER_COMPLETED') {
    try {
      const startAt = new Date(`${existing.date}T${existing.time}:00`).toISOString();
      const teamMemberId = (existing.staff && squareMapping.staffTeamMemberIds[existing.staff.id])
        || squareMapping.staffTeamMemberIds.any;

      const result = await square.createBooking({
        startAt,
        locationId: squareMapping.locationId,
        serviceVariationId: squareMapping.defaultServiceVariationId,
        teamMemberId,
        durationMinutes: existing.service.duration || 60,
        customerNote: `${existing.dog.name} (${existing.dog.breed}) — ${existing.service.name}. Notes: ${existing.notes || 'none'}`,
        idempotencyKey: orderId, // safe to retry without double-booking
      });

      store.saveOrder(orderId, {
        status: 'paid',
        squareBookingId: result.booking.id,
        paidAt: new Date().toISOString(),
      });
      console.log(`Order ${orderId} paid and booked in Square as ${result.booking.id}.`);
    } catch (err) {
      // Payment succeeded but the Square sync failed — the deposit has been
      // taken, so we still mark the appointment as paid, but flag it so the
      // salon can add it to Square manually.
      console.error(`Order ${orderId} paid, but Square booking failed:`, err.message);
      store.saveOrder(orderId, {
        status: 'paid_booking_failed',
        bookingError: err.message,
        paidAt: new Date().toISOString(),
      });
    }
  } else if (['ORDER_CANCELLED', 'ORDER_PAYMENT_FAILED', 'ORDER_EXPIRED'].includes(event.event)) {
    store.saveOrder(orderId, { status: 'failed' });
    console.log(`Order ${orderId} did not complete (${event.event}).`);
  }
});

module.exports = router;
