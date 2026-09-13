# Luxury Paws — Deposit & Booking Backend (Sandbox)

This is the small server that sits between your public booking page and
Revolut/Square. It exists for one reason: **secret API keys must never live
in a browser-facing HTML file.** Your booking page (`luxury-paws-booking.html`)
only ever calls the three endpoints below — it never talks to Revolut or
Square directly.

Everything here is wired to **sandbox/test environments only**. No production
keys are used or requested anywhere in this code.

## What it does

```
Customer clicks "Pay 50% Deposit"
        │
        ▼
POST /api/create-deposit-order   → creates a Revolut Sandbox order,
                                    returns a checkout URL
        │
        ▼
Browser redirects to Revolut's hosted checkout (test card, no real money)
        │
        ▼
Revolut sends a webhook  →  POST /api/webhooks/revolut
        │                    - verifies the signature
        │                    - on success, creates the appointment in
        │                      Square Sandbox
        │
        ▼
Browser (back on your page) polls  →  GET /api/order-status/:orderId
        │
        ▼
Once "paid", the booking page writes the final booking record
(with deposit/remaining balance/payment status) into its own storage —
exactly as it already did before payments existed.
```

If payment fails, is cancelled, or expires, no booking is ever written —
the customer sees a "payment wasn't completed" screen and nothing is
confirmed.

## Running it locally

```bash
cd luxury-paws-backend
npm install
cp .env.example .env
# fill in .env with your SANDBOX credentials (see checklist below)
npm start
```

The server listens on `http://localhost:4000` by default. Update
`API_BASE_URL` near the top of `luxury-paws-booking.html`'s `<script>` if you
run it somewhere else.

Revolut needs to reach your webhook endpoint from the internet, so for local
testing you'll also want a tunnel (e.g. `ngrok http 4000`) and to register
`https://<your-ngrok-id>.ngrok.io/api/webhooks/revolut` as your webhook URL
in the Revolut Sandbox dashboard.

---

## ✅ Setup checklist — Revolut Sandbox

1. **Create a Revolut Sandbox account** — this is free and separate from a
   real Revolut Business account, at `developer.revolut.com` → Sandbox
   (no live business required to start testing).
2. Inside the sandbox, open **Merchant → API** and generate an **API key
   pair**:
   - `REVOLUT_SECRET_KEY` — server-side only, goes in `.env`.
   - Public key — not needed for this integration since we use the hosted
     checkout redirect, not the embedded widget.
3. Set up a **webhook**: point it at
   `https://<your-server>/api/webhooks/revolut` and subscribe to at least
   `ORDER_COMPLETED`, `ORDER_CANCELLED`, `ORDER_PAYMENT_FAILED`,
   `ORDER_EXPIRED`. Copy the **webhook signing secret** into
   `REVOLUT_WEBHOOK_SECRET`.
4. Use Revolut's published **sandbox test card numbers** (in their docs)
   when you reach the hosted checkout page — never a real card.
5. Double-check the webhook header names/signing scheme against Revolut's
   current docs before relying on it for real money — I implemented this
   from their documented pattern, but it's worth a quick verification pass
   against your actual sandbox account before going live.

## ✅ Setup checklist — Square Sandbox

1. **Create/open a Square Developer account** at `developer.squareup.com`
   and create an **Application** in the Developer Console.
2. On the app's **Credentials** tab, copy the **Sandbox Access Token** →
   `SQUARE_ACCESS_TOKEN`.
3. In the **Sandbox test seller account** (Square gives you one automatically
   per app), go to **Square Dashboard → Appointments**:
   - Subscribe the sandbox seller to **Appointments Plus or Premium** (the
     free plan only supports one staff calendar — you have three groomers).
   - Add **Team Members** named Klaudia, Monika and Leah, and make each
     bookable. Copy each one's **Team Member ID** (Team API or dashboard)
     into `SQUARE_TEAM_MEMBER_KLAUDIA` / `_MONIKA` / `_LEAH`.
   - Create one bookable **Service** (e.g. "Dog Grooming Appointment") and
     copy its **Service Variation ID** into `SQUARE_SERVICE_VARIATION_ID`.
     (We use one generic Square service and pass the real breed/service/price
     through as the booking note — see `src/square-mapping.js` for why, and
     let me know if you'd rather mirror every Luxury Paws service exactly in
     Square's own catalog, which is a bigger follow-up.)
   - Copy the sandbox **Location ID** into `SQUARE_LOCATION_ID`.
4. Confirm your **live** Square account's actual Appointments plan
   separately (Dashboard → Appointments → Settings → Subscription) — the
   sandbox subscription above doesn't affect your real account, and you'll
   need the same paid plan live before this goes to production, since you
   have three staff calendars.

## ✅ Setup checklist — Instagram live feed

The homepage's Instagram section calls `GET /api/instagram-feed` on this
backend, which fetches your recent posts server-side — your access token
never reaches the browser. Until this is connected, the homepage just shows
placeholder tiles, so there's no rush.

1. Your Instagram account (`@_luxurypaws_`) must be a **Professional
   account** (Business or Creator) — convert it in the Instagram app under
   Settings if it isn't already.
2. Connect that Instagram account to a **Facebook Page** you control (also
   in Instagram/Facebook settings) — the Graph API requires this link.
3. Create a **Meta Developer App** at developers.facebook.com, add the
   **Instagram Graph API** product to it.
4. Using Meta's Graph API Explorer (or the app's setup flow), generate a
   **long-lived access token** for your Instagram professional account, and
   find your **Instagram User ID** (a numeric ID, not your @handle).
5. Put both into `.env`:
   ```
   INSTAGRAM_ACCESS_TOKEN=your_long_lived_token
   INSTAGRAM_USER_ID=your_numeric_ig_user_id
   ```
6. **Note on upkeep**: long-lived tokens expire roughly every 60 days and
   need refreshing (Meta provides a refresh endpoint for this). For a
   low-traffic single-location site, the simplest approach is a calendar
   reminder every ~50 days to refresh it by hand; if that becomes annoying,
   we can add a small automated refresh job later.

Once both env vars are set, restart the server and refresh the homepage —
your 8 most recent posts should replace the placeholder tiles automatically.

## Testing safely, end to end

1. Fill in `.env` with sandbox values only.
2. `npm start`, open your booking page, and complete a real booking.
3. On the deposit screen, pay with a Revolut sandbox test card.
4. Confirm: the webhook fires (check your server logs), a booking appears
   in the Square Sandbox seller's Appointments calendar, and the booking
   page shows the "You're all set" screen with deposit/remaining balance.
5. Also test a **failed/cancelled** payment on purpose, and confirm no
   booking is created anywhere.

Only once all of that passes should production keys ever enter this
project — and even then, they'd replace the sandbox values in `.env` on
your server, never in the frontend file.
