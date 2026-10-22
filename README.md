# PelotonHub — Setup Guide

A local bike-shop platform built with **HTML + CSS + JavaScript** and **Firebase**
(Authentication + Cloud Firestore). There is no server-side code — the storefront
and the admin console both talk to Firestore directly from the browser.

---

## Requirements

| Software | Notes |
|----------|-------|
| A Firebase project | Free Spark plan is enough |
| Any static file server | VS Code **Live Server**, `npx serve`, `python -m http.server`, Firebase Hosting, etc. |
| Browser | Any modern browser |

> The pages use JavaScript modules, which browsers block on `file://` URLs.
> Always open the site through a local server, not by double-clicking the HTML file.

---

## Step-by-Step Setup

### 1. Configure Firebase

1. Go to <https://console.firebase.google.com/> and create (or open) your project.
2. **Authentication → Sign-in method** → enable **Email/Password**.
3. **Firestore Database** → create a database (start in test mode while developing).
4. **Project settings → Your apps** → add a Web app and copy its `firebaseConfig`.
5. Paste that config into `js/firebase.js` (the `firebaseConfig` object near the top).

### 2. Serve the folder

From the project folder, for example:

```
npx serve .
```

or open the folder in VS Code and click **Go Live**.

### 3. Seed the database (one time)

1. Temporarily add this line before `</body>` in `index.html`:
   ```html
   <script type="module" src="js/firebase-seed.js"></script>
   ```
2. Open `index.html` in the browser and open **DevTools → Console**.
3. Wait for `✅ Seed complete!` — this writes 31 products (with reviews), 3 events,
   3 promo codes, the tier-discount settings, and creates the admin account.
4. Remove the script tag again.

### 4. Publish the Firestore security rules

The rules in `firestore.rules` decide who may write what — for example, a support ticket can only be
created by the signed-in customer it belongs to. Deploy them once (and again after changing them):

```
firebase deploy --only firestore:rules
```

### 5. Open the site

| Page | Path |
|------|------|
| **Storefront landing** | `index.html` |
| **Admin login** | `admin/login.html` |

---

## Mobile App (APK) — order on a phone, manage on a laptop

The storefront is built mobile-first (bottom tab bar, slide-up filters, sticky
Add to Cart) and is an installable web app (`manifest.webmanifest`, `sw.js`,
icons in `img/icons/`). An APK needs the site online, because a phone cannot load
files from your laptop.

### 1. Put the site online (Firebase Hosting, free)
```
npm install -g firebase-tools
firebase login
firebase hosting:sites:create pelotonhub   # first time only
firebase deploy --only hosting
```
Run these in the project folder (`firebase.json` and `.firebaserc` are already set up).
The site goes live at **https://pelotonhub.web.app**. The Firebase project itself is still
named `peletonhub` (project IDs can't be renamed), so add `pelotonhub.web.app` under
Firebase Console → Authentication → Settings → Authorized domains for sign-in to work.

### 2. Make the APK
A ready-built debug APK is included at `release/PelotonHub-debug.apk` — copy it to an Android phone and install it.
To build a new one:

1. Open <https://www.pwabuilder.com>, enter `https://pelotonhub.web.app/index.html`, click **Start**.
2. Choose **Package for stores → Android → Generate**, then download the zip.
3. Copy the `.apk` from the zip to the phone and install it (allow "install unknown apps").

### 3. Demo
| Who | Device | Open |
|-----|--------|------|
| Customer (prof) | Phone — the PelotonHub app | Register, browse, add to cart, reserve |
| Admin | Laptop browser | `https://pelotonhub.web.app/admin/login.html` → Orders, Stock, Dashboard |

An order placed on the phone shows up in Admin → Orders as soon as the page is
opened, and its stock is taken from Admin → Stock Management.

Re-run `firebase deploy --only hosting` after changing any file; the app picks up
the new version the next time it is opened.

---

## Default Credentials

### Admin Console
The seed script creates a starter admin account with a temporary password
(see `js/firebase-seed.js`). **Replace it right after seeding**: create your own
admin user in Firebase Console → Authentication → Users, add a document with its
UID to the `admins` collection, then delete the starter account.

An account is treated as an admin when a document with its Firebase Auth UID
exists in the `admins` collection. The admin console is at `admin/login.html`
and is intentionally not linked from the storefront.

### Customer Accounts
Register a new account via **Create Account** on the storefront.
Available membership tiers: **Spoke** (free) · **Chain** (₱499/mo) · **Peloton** (₱999/mo)

---

## Project Structure

```
SIA LAST FINAL PROJECT/
│
├── index.html              ← Storefront landing / sign-in
├── home.html               ← Storefront home page
├── auth.html               ← Register & sign-in page
├── catalog.html            ← Product catalog with filters
├── product.html            ← Product detail page (?id=...)
├── cart.html               ← Cart + 3-step reservation checkout
├── orders.html             ← Customer order history
├── events.html             ← Events & RSVP
├── membership.html         ← Membership tier comparison
├── support.html            ← Contact / support ticket form
├── profile.html            ← Member profile, wishlist, sign out
│
├── admin/                  ← Admin console
│   ├── login.html
│   ├── index.html          ← Dashboard
│   ├── products.html
│   ├── stock.html          ← Stock management
│   ├── orders.html
│   ├── customers.html
│   ├── events.html
│   ├── membership.html     ← Tier discount settings
│   ├── messages.html       ← Support tickets
│   ├── css/admin.css
│   └── js/admin-common.js  ← Admin guard, sidebar, logout; exposes window.FB
│
├── css/styles.css
├── js/
│   ├── firebase.js         ← Firebase init + every data function (api*)
│   ├── firebase-seed.js    ← One-time Firestore seeder
│   └── main.js             ← Storefront nav, toast, cart badge, getUser()
└── img/products/           ← Product images
```

---

## Firestore Collections

| Collection | Purpose |
|------------|---------|
| `users/{uid}` | Customer profiles (name, email, tier, points, status) |
| `users/{uid}/cart` | Per-user cart lines |
| `admins/{uid}` | Admin accounts |
| `products` | Catalog products (soft-deleted with `deleted: true`) |
| `products/{id}/reviews` | Product reviews |
| `events` | Group rides and charity events — also carries the optional map location (`lat`, `lng`, `address`) |
| `rsvps` | Customer ↔ event RSVPs |
| `orders` | Customer reservations |
| `orders/{id}/items` | Line items per order |
| `wishlists` | Saved products per user |
| `promo_codes` | Discount codes (SPOKE10, RIDE2026, NEWMEMBER) |
| `config/settings` | Tier discounts |
| `support_tickets` | Customer support messages (admin replies in `replies` sub-collection) |

---

## Support Emails (EmailJS)

The Contact Us form (`support.html`) and admin replies (`admin/messages.html`) send email through
[EmailJS](https://www.emailjs.com) straight from the browser (`js/email.js`). Tickets are always saved
to Firestore first; if email isn't configured or fails, nothing else breaks.

**Only signed-in customers can use the Contact Us form.** A visitor who isn't signed in gets a sign-in
prompt instead of the form, the ticket is saved with the email address on their account, and the reply
goes to that address. The Firestore rules enforce this as well (`support_tickets` can only be created by
the signed-in owner), so nobody can use the form to send mail to an address they don't own.

| When | Email | Goes to |
|------|-------|---------|
| Customer submits Contact Us | New-ticket notice (Reply-To = customer) | Shop inbox (`SHOP_EMAIL`) |
| Customer submits Contact Us | "We received your message" + copy | Customer |
| Admin clicks **Send Reply** | The reply text | Customer |

**Setup (free plan is enough: 200 emails/month, 2 templates):**

1. Sign up at emailjs.com → **Email Services → Add New Service** → Gmail → connect the shop's Gmail. Copy the **Service ID**.
2. **Email Templates → Create New Template** → set its Template ID to `template_shop`:
   - To Email: `{{to_email}}` · Reply To: `{{reply_to}}` · From Name: `PelotonHub Support Form`
   - Subject: `New support ticket: {{topic}} — {{from_name}} ({{ticket_ref}})`
   - Content:
     ```
     From: {{from_name}} <{{from_email}}>
     Topic: {{topic}}
     Order reference: {{order_ref}}

     {{message}}
     ```
3. Create a second template with ID `template_customer`:
   - To Email: `{{to_email}}` · Reply To: `{{reply_to}}` · From Name: `{{shop_name}}`
   - Subject: `{{subject}}`
   - Content:
     ```
     Hi {{to_name}},

     {{heading}}

     {{message}}

     — The {{shop_name}} team
     ```
4. **Account → General** → copy the **Public Key**. If you restrict allowed domains under
   **Account → Security**, include `pelotonhub.web.app` and `localhost` (the APK and local testing use it).
5. Open `js/email.js` and fill in `publicKey`, `serviceId` and `SHOP_EMAIL`, then redeploy (`firebase deploy --only hosting`).

The public key is meant to live in front-end code — it can only send using your own templates.

---

## How Admin & Storefront Are Connected

```
Customer                         Admin
   │                               │
   ▼                               ▼
storefront HTML pages         admin HTML pages
   │                               │
   └──────── js/firebase.js ───────┘
                  │
                  ▼
     Firebase Auth + Cloud Firestore
```

- A customer registers → Firebase Auth user + `users/{uid}` document
- Customer adds to cart → `users/{uid}/cart`
- Customer checks out → `orders` + `orders/{id}/items`, stock decremented, cart cleared
- Admin changes order status → order updated (cancelling restores stock)
- Admin edits a product → catalog shows the new data on next page load
- Admin saves tier discounts → `config/settings` — `membership.html` reads live values
- Admin sets an event location → `lat` / `lng` / `address` on the `events` doc — `events.html` shows the map

---

## Event Locations (Leaflet + OpenStreetMap)

Admins can drop a pin on the ride's start point when creating or editing an event.
It is built on **Leaflet 1.9.4** with **OpenStreetMap** tiles, so **no API key and no
billing account are needed** — the map, the place search and the address lookup all
come from free OpenStreetMap services.

**In the admin console** (`admin/events.html` → Events & RSVPs → *+ New Event*):

| Control | What it does |
|---------|--------------|
| Search box | Type a place name (e.g. *Rizal Park*, *BGC Taguig*) and pick a result — the map jumps there |
| Map | Click anywhere to drop the marker, or drag the marker to fine-tune it |
| Latitude / Longitude | Filled in automatically (read-only) |
| Address | Reverse-geocoded from the pin via Nominatim |
| 🗺️ Open in OSM / 📍 Open in Google Maps | Opens the point in another map app |
| 🎯 Center on Marker | Re-centres the map on the pin |
| ✖ Clear Location | Removes the location entirely (the field is optional) |

**What gets stored** on the `events` document — all three are optional:

| Field | Type | Notes |
|-------|------|-------|
| `lat` | number \| null | Latitude of the start point |
| `lng` | number \| null | Longitude of the start point |
| `address` | string \| null | Human-readable address from reverse geocoding |

**On the storefront** (`events.html`), events that have coordinates render a small
read-only map with a marker, the address and buttons for OSM / Google Maps
directions. Events without coordinates simply show no map.

**Services used** (all keyless): tiles from `tile.openstreetmap.org`, search and
reverse geocoding from `nominatim.openstreetmap.org`. Nominatim asks for no more
than ~1 request per second, so the search box debounces as you type.

---

## Promo Codes (pre-seeded)

| Code | Discount |
|------|---------|
| `SPOKE10` | 10% |
| `RIDE2026` | 15% |
| `NEWMEMBER` | 5% |

Enter these on the Cart page. The higher of the promo code discount and the
member tier discount is applied — they do not stack.

---

## Common Troubleshooting

| Problem | Fix |
|---------|-----|
| Blank page / nothing loads | You opened the file directly — serve the folder over `http://` (see step 2) |
| Console error "The query requires an index" | Click the link in the error message; Firestore creates the composite index for you (takes a minute) |
| "Missing or insufficient permissions" | Your Firestore security rules block the request — use test mode while developing, then write proper rules |
| Admin login says "Invalid credentials" | Make sure the seed ran, or that an `admins/{uid}` document exists for that account |
| Catalog shows no products | The seed script hasn't been run against this Firebase project |
| Uploaded product images look small | Without Firebase Storage, uploads are resized to 800px and stored inside the product document |
| Event map is blank / grey | The map needs internet access — Leaflet and the OpenStreetMap tiles are loaded from a CDN. Check the network tab for blocked requests |
| Event map says "Map unavailable" | The Leaflet CDN was blocked; the rest of the admin page still works, but no pin can be placed until the network allows `unpkg.com` |
| Place search returns nothing | Nominatim only matches places it knows about — try a broader name ("Rizal Park" rather than "Rizal Park North Entrance") |

## Payments (MongoDB + PayMongo)

Payments run on a separate server in `server/` (Node.js + Express + MongoDB), with online checkout
through **PayMongo** (GCash, Maya, cards, GrabPay). Accounts, products and orders stay in Firebase.
The storefront and admin console talk to it through `js/mongo-payment.js`.

See `server/README.md` for how it works, running it on your PC, and putting it online
(MongoDB Atlas + Render, using `render.yaml`).
