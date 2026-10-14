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

### 4. Open the site

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
firebase deploy --only hosting
```
Run these in the project folder (`firebase.json` and `.firebaserc` are already set up).
The site goes live at **https://peletonhub.web.app**. That domain is already allowed for
Firebase sign-in.

### 2. Make the APK
1. Open <https://www.pwabuilder.com>, enter `https://peletonhub.web.app/index.html`, click **Start**.
2. Choose **Package for stores → Android → Generate**, then download the zip.
3. Copy the `.apk` from the zip to the phone and install it (allow "install unknown apps").

### 3. Demo
| Who | Device | Open |
|-----|--------|------|
| Customer (prof) | Phone — the PelotonHub app | Register, browse, add to cart, reserve |
| Admin | Laptop browser | `https://peletonhub.web.app/admin/login.html` → Orders, Stock, Dashboard |

An order placed on the phone shows up in Admin → Orders as soon as the page is
opened, and its stock is taken from Admin → Stock Management.

Re-run `firebase deploy --only hosting` after changing any file; the app picks up
the new version the next time it is opened.

---

## Default Credentials

### Admin Console
| Field | Value |
|-------|-------|
| Email | `admin@pelotonhub.ph` |
| Password | `admin123` |

An account is treated as an admin when a document with its Firebase Auth UID
exists in the `admins` collection. The seed script creates both.

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
| `events` | Group rides and charity events |
| `rsvps` | Customer ↔ event RSVPs |
| `orders` | Customer reservations |
| `orders/{id}/items` | Line items per order |
| `wishlists` | Saved products per user |
| `promo_codes` | Discount codes (SPOKE10, RIDE2026, NEWMEMBER) |
| `config/settings` | Tier discounts |
| `support_tickets` | Customer support messages (admin replies in `replies` sub-collection) |

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
