// Minimal JSON-file store for tracking deposit orders between the moment a
// customer starts checkout and the moment Revolut's webhook confirms payment.
//
// IMPORTANT: this is a deliberately simple placeholder, good enough for
// testing and for a single always-on Node process (e.g. a small Render/
// Railway service). It is NOT safe for:
//   - true serverless platforms that don't guarantee a persistent disk
//     between invocations (e.g. Vercel/Netlify functions) — the file may not
//     exist on the next cold start
//   - multiple server instances running at once (no locking, last write wins)
// Before taking real payments at any volume, swap this for a proper database
// (hosted Postgres, SQLite on a persistent volume, Upstash Redis, etc.) —
// the rest of the code only calls saveOrder()/getOrder(), so swapping the
// implementation here is a contained change.
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'orders.json');

function ensureDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify({}, null, 2));
}

function readAll() {
  ensureDb();
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch (err) {
    console.error('Order store is corrupt or unreadable, starting fresh:', err.message);
    return {};
  }
}

function writeAll(data) {
  ensureDb();
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

/** Creates or merges fields onto the order record keyed by Revolut's order id. */
function saveOrder(orderId, fields) {
  const all = readAll();
  all[orderId] = { ...(all[orderId] || {}), ...fields, updatedAt: new Date().toISOString() };
  writeAll(all);
  return all[orderId];
}

function getOrder(orderId) {
  const all = readAll();
  return all[orderId] || null;
}

module.exports = { saveOrder, getOrder };
