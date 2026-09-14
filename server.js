require('dotenv').config();
const express = require('express');
const cors = require('cors');

const depositRouter = require('./routes/deposit');
const webhookRouter = require('./routes/webhook');
const statusRouter = require('./routes/status');
const instagramRouter = require('./routes/instagram');

const app = express();

// The Revolut webhook needs the exact raw request bytes to verify the
// signature, so it must be mounted BEFORE express.json() below — once
// express.json() parses a request, the raw body is gone.
app.use('/api/webhooks/revolut', express.raw({ type: '*/*' }), webhookRouter);

app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(express.json());

app.use('/api/create-deposit-order', depositRouter);
app.use('/api/order-status', statusRouter);

app.get('/health', (req, res) => res.json({ ok: true, env: process.env.SQUARE_ENV || 'sandbox' }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Luxury Paws backend listening on port ${PORT}`);
  
  console.log(`Revolut env: ${process.env.REVOLUT_ENV || 'sandbox (default)'}`);
  console.log(`Square env: ${process.env.SQUARE_ENV || 'sandbox (default)'}`);
});
