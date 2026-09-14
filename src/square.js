// Square Bookings API helper.
// Docs: https://developer.squareup.com/docs/bookings-api/what-it-is
//
// SQUARE_ENV controls which base URL is used. Defaults to sandbox.
const SQUARE_API_BASE = process.env.SQUARE_ENV === 'production'
  ? 'https://connect.squareup.com/v2'
  : 'https://connect.squareupsandbox.com/v2';

const SQUARE_API_VERSION = '2026-06-18';

function authHeaders() {
  if (!process.env.SQUARE_ACCESS_TOKEN) {
    throw new Error('SQUARE_ACCESS_TOKEN is not set. Add it to your .env file.');
  }
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
    'Square-Version': SQUARE_API_VERSION,
  };
}

/**
 * Creates a booking in Square Appointments.
 * Square needs real Catalog/Team/Location IDs — see src/square-mapping.js
 * and the README for exactly where to get them from your Sandbox seller account.
 */
async function createBooking({ startAt, locationId, serviceVariationId, teamMemberId, durationMinutes, customerNote, idempotencyKey }) {
  const res = await fetch(`${SQUARE_API_BASE}/bookings`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      idempotency_key: idempotencyKey,
      booking: {
        start_at: startAt,
        location_id: locationId,
        customer_note: customerNote,
        appointment_segments: [
          {
            duration_minutes: durationMinutes,
            team_member_id: teamMemberId,
            service_variation_id: serviceVariationId,
            service_variation_version: 1,
          },
        ],
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Square createBooking failed (${res.status}): ${text}`);
  }
  return res.json();
}

module.exports = { createBooking, SQUARE_API_BASE };
