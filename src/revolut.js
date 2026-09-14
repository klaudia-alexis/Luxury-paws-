// Revolut Merchant API helper.
// Docs: https://developer.revolut.com/docs/merchant/merchant-api
//
// REVOLUT_ENV controls which base URL is used. Defaults to sandbox so nothing
// can accidentally hit real Revolut infrastructure until you explicitly set
// REVOLUT_ENV=live (and swap in a live secret key) once you're ready.
const crypto = require('crypto');

const REVOLUT_API_BASE = process.env.REVOLUT_ENV === 'live'
  ? 'https://merchant.revolut.com/api'
  : 'https://sandbox-merchant.revolut.com/api';

// Pin an explicit API version so Revolut's rolling updates don't silently
// change response shapes under us. Bump this deliberately when you upgrade.
const REVOLUT_API_VERSION = '2026-04-20';

function authHeaders() {
  if (!process.env.REVOLUT_SECRET_KEY) {
    throw new Error('REVOLUT_SECRET_KEY is not set. Add it to your .env file.');
  }
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.REVOLUT_SECRET_KEY}`,
    'Revolut-Api-Version': REVOLUT_API_VERSION,
  };
}

/**
 * Creates a Revolut order for the deposit amount and returns a hosted
 * checkout URL to redirect the customer's browser to.
 * @param {object} params
 * @param {number} params.amount - Amount in MINOR units (e.g. cents). €35.00 -> 3500
 * @param {string} params.currency - ISO 4217 currency code, e.g. 'EUR'
 * @param {string} params.email - Customer email (used to create/match a Revolut customer)
 * @param {string} params.name - Customer full name
 * @param {string} params.description - Shown to the customer at checkout
 * @param {string} params.redirectUrl - Where Revolut sends the browser back to after checkout
 * @param {object} [params.metadata] - Free-form metadata stored on the order
 */
async function createOrder({ amount, currency, email, name, description, redirectUrl, metadata }) {
  const res = await fetch(`${REVOLUT_API_BASE}/orders`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      amount,
      currency,
      customer: { email, full_name: name },
      description,
      redirect_url: redirectUrl,
      capture_mode: 'AUTOMATIC',
      metadata,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Revolut createOrder failed (${res.status}): ${text}`);
  }
  return res.json();
}

/** Fetches the current state of an order directly from Revolut. */
async function getOrder(orderId) {
  const res = await fetch(`${REVOLUT_API_BASE}/orders/${orderId}`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Revolut getOrder failed (${res.status}): ${text}`);
  }
  return res.json();
}

/**
 * Verifies the signature Revolut attaches to webhook requests, so we only
 * ever act on events that genuinely came from Revolut.
 *
 * NOTE: this implements Revolut's documented HMAC-SHA256 scheme
 * (`Revolut-Signature` / `Revolut-Request-Timestamp` headers, payload
 * `v1.{timestamp}.{raw_body}`). Double-check this against the current
 * Revolut webhook docs when you wire up real sandbox credentials — header
 * names and the signing scheme are the kind of detail that can shift
 * between API versions.
 */
function verifyWebhookSignature(rawBody, signatureHeader, timestampHeader) {
  const secret = process.env.REVOLUT_WEBHOOK_SECRET;
  if (!secret) throw new Error('REVOLUT_WEBHOOK_SECRET is not set. Add it to your .env file.');
  if (!signatureHeader || !timestampHeader) return false;

  const payloadToSign = `v1.${timestampHeader}.${rawBody}`;
  const expected = 'v1=' + crypto.createHmac('sha256', secret).update(payloadToSign).digest('hex');

  const provided = signatureHeader.split(',').map(s => s.trim()).find(s => s.startsWith('v1='));
  if (!provided) return false;

  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = { createOrder, getOrder, verifyWebhookSignature, REVOLUT_API_BASE };
