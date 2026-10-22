// Writes to Firestore as the shop (not as a customer), for the one thing a customer
// must never do themselves: switching on a paid membership tier.
//
// Uses a Firebase service account given in the FIREBASE_SERVICE_ACCOUNT environment
// variable (the whole JSON file from Firebase console → Project settings → Service
// accounts → Generate new private key). The key signs a short-lived Google access
// token; Firestore's REST API then accepts writes that skip the security rules.
// Without the variable nothing breaks: tiers are simply switched on by an admin.
const { SignJWT, importPKCS8 } = require('jose');
const { PROJECT_ID } = require('../middleware/auth');

const TIER_RANK = { Spoke: 0, Chain: 1, Peloton: 2 };

function readServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw);
    if (!sa.client_email || !sa.private_key) throw new Error('missing client_email or private_key');
    sa.private_key = sa.private_key.replace(/\\n/g, '\n');   // pasted with escaped newlines
    return sa;
  } catch (err) {
    console.error('[firestoreAdmin] FIREBASE_SERVICE_ACCOUNT is not valid JSON:', err.message);
    return null;
  }
}

const SA = readServiceAccount();
let cached = { token: null, expires: 0 };

async function accessToken() {
  if (cached.token && Date.now() < cached.expires - 60_000) return cached.token;
  const key = await importPKCS8(SA.private_key, 'RS256');
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/datastore' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(SA.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error('Google token: ' + (data.error_description || data.error || res.status));
  cached = { token: data.access_token, expires: Date.now() + data.expires_in * 1000 };
  return cached.token;
}

const userUrl = uid =>
  `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${encodeURIComponent(uid)}`;

/**
 * Switch a customer's tier on after a confirmed membership payment.
 * Never lowers a tier (paying for Chain while already on Peloton changes nothing).
 * Returns { ok, tier } or { ok: false, error }.
 */
async function activateMembership(uid, tier, paymentRef) {
  if (!SA) return { ok: false, error: 'FIREBASE_SERVICE_ACCOUNT is not set' };
  if (!uid || !(tier in TIER_RANK)) return { ok: false, error: 'Bad user or tier' };
  const headers = { Authorization: 'Bearer ' + await accessToken(), 'Content-Type': 'application/json' };

  const cur = await fetch(userUrl(uid), { headers });
  if (!cur.ok) return { ok: false, error: 'Customer profile not found' };
  const current = (await cur.json()).fields?.tier?.stringValue || 'Spoke';
  if (TIER_RANK[current] >= TIER_RANK[tier]) return { ok: true, tier: current };

  const fields = ['tier', 'updated_at', 'membership_paid_at', 'membership_payment'];
  const mask = fields.map(f => 'updateMask.fieldPaths=' + f).join('&');
  const now = new Date().toISOString();
  const res = await fetch(`${userUrl(uid)}?${mask}&currentDocument.exists=true`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ fields: {
      tier:               { stringValue: tier },
      updated_at:         { timestampValue: now },
      membership_paid_at: { timestampValue: now },
      membership_payment: { stringValue: String(paymentRef || '') },
    } }),
  });
  if (!res.ok) return { ok: false, error: 'Firestore write failed (' + res.status + ')' };
  return { ok: true, tier };
}

module.exports = { activateMembership, adminWritesEnabled: () => !!SA };
