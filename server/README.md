# PelotonHub Payment Server

Node.js + Express + **MongoDB** (Mongoose) + **PayMongo**. Records every payment for store
reservations and membership upgrades, and runs online checkout (GCash, Maya, cards, GrabPay)
through PayMongo's hosted page.

The storefront and admin console call it through `js/mongo-payment.js`. Accounts, products and
orders stay in Firebase; this server only handles payments.

## How a payment works

| Customer picks | What happens |
|---|---|
| **Cash on pickup** | `POST /api/payments` records it as `pending`; an admin clicks **Mark Paid** in Admin → Payments when the customer pays at the counter. |
| **Pay online** | `POST /api/paymongo/checkout` records a `pending` payment and returns PayMongo's checkout link. After paying, PayMongo returns the customer to `payment-result.html`, which calls `GET /api/paymongo/verify/:id`; the server asks PayMongo and marks it `paid`. The webhook does the same even if the customer closes the page. |

Security:
- Every call (except health and the webhook) needs the customer's **Firebase sign-in token**; the server verifies it with Google's public keys.
- **Amounts are never taken from the browser**: an order's total is read from Firestore with the customer's own token (so only their own orders), and memberships use the fixed price list (Chain ₱499, Peloton ₱999).
- Listing, marking paid and refunding are **admin-only** (`ADMIN_UIDS`).
- The webhook is accepted only with a valid **PayMongo signature** (`PAYMONGO_WEBHOOK_SECRET`).
- PayMongo may only send customers back to the addresses in `APP_URLS`.
- A **paid membership switches the tier on automatically** (after PayMongo, or when an admin marks a cash membership paid). The server writes the new tier to `users/{uid}` with a Firebase service account (`FIREBASE_SERVICE_ACCOUNT`); customers still can't change their own tier. It never lowers a tier. Without the variable, an admin switches tiers on by hand.

## Endpoints

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/api/health` | anyone | Health check / wake the server |
| POST | `/api/payments` | signed in | Record a cash payment: `{ type:'order', orderId }` or `{ type:'membership', tier }` |
| GET | `/api/payments/mine` | signed in | The customer's own payments |
| GET | `/api/payments/:id` | owner / admin | One payment |
| POST | `/api/paymongo/checkout` | signed in | Start online payment → `{ checkoutUrl }` |
| GET | `/api/paymongo/verify/:id` | owner / admin | Check with PayMongo and mark paid |
| POST | `/api/paymongo/webhook` | PayMongo | `checkout_session.payment.paid` events |
| GET | `/api/payments` | admin | List (filters `status`, `orderId`, `userId`) |
| PATCH | `/api/payments/:id` | admin | Change status, e.g. cash received → `paid` |
| POST | `/api/payments/:id/refund` | admin | Refund (through PayMongo for online payments) |

## Run on your PC

```bash
cp .env.example .env      # fill in MONGO_URI and PAYMONGO_SECRET_KEY (sk_test_…)
npm install
npm start                 # http://localhost:5000
```

Open the site at `http://localhost:5500` (or `127.0.0.1:5500`) and it uses this local server
automatically; the live website and the app use the hosted one.

## Put it online (free)

1. **MongoDB Atlas** — create a free M0 cluster, a database user, allow access from anywhere
   (`0.0.0.0/0`), and copy the `mongodb+srv://…` connection string.
2. **PayMongo** — sign up, stay in **Test mode**, copy the secret key (`sk_test_…`).
3. **Render** — New → Blueprint → this GitHub repo (uses `render.yaml`). Enter `MONGO_URI` and
   `PAYMONGO_SECRET_KEY` when asked.
4. **Webhook (optional, recommended)** — PayMongo → Developers → Webhooks → add
   `https://<your-render-url>/api/paymongo/webhook` for `checkout_session.payment.paid`, then put
   its secret (`whsk_…`) in Render as `PAYMONGO_WEBHOOK_SECRET`.

5. **Automatic membership activation** — Firebase console → Project settings → Service accounts →
   **Generate new private key**. Open the downloaded JSON, copy all of it, and add it on Render as
   `FIREBASE_SERVICE_ACCOUNT` (Environment → Add variable). Keep the file private and never commit it.

If the Render address isn't `https://pelotonhub-payments.onrender.com`, update `PRODUCTION_API`
in `js/mongo-payment.js`.

The free Render plan sleeps after 15 minutes without traffic; the first request then takes
about 30–60 seconds. The cart and membership pages wake it up as soon as they open.

## Test payments

In PayMongo test mode no real money moves. Use card `4343 4343 4343 4345` (any future expiry,
any CVC), or pick GCash / Maya and click **Authorize Test Payment** on PayMongo's test page.
