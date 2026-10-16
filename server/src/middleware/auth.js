// Who is calling? The website/app sends the signed-in user's Firebase ID token
// (Authorization: Bearer <token>). We check its signature against Google's public
// keys, so no Firebase service-account file is needed on the server.
const { createRemoteJWKSet, jwtVerify } = require('jose');

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'peletonhub';
const JWKS = createRemoteJWKSet(new URL(
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
));
// Admins: comma-separated Firebase UIDs (the same accounts listed in Firestore → admins)
const ADMIN_UIDS = (process.env.ADMIN_UIDS || '').split(',').map(s => s.trim()).filter(Boolean);

async function readUser(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${PROJECT_ID}`,
      audience: PROJECT_ID,
    });
    return { uid: payload.sub, email: payload.email || null, token, isAdmin: ADMIN_UIDS.includes(payload.sub) };
  } catch {
    return null;
  }
}

async function requireUser(req, res, next) {
  req.user = await readUser(req);
  if (!req.user) return res.status(401).json({ ok: false, error: 'Please sign in again' });
  next();
}

async function requireAdmin(req, res, next) {
  req.user = await readUser(req);
  if (!req.user) return res.status(401).json({ ok: false, error: 'Please sign in again' });
  if (!req.user.isAdmin) return res.status(403).json({ ok: false, error: 'Admins only' });
  next();
}

module.exports = { requireUser, requireAdmin, PROJECT_ID };
