/* PelotonHub service worker — makes the site installable as an app (PWA / APK).
   Network-first: online users always get the latest pages; the cached copy is
   only used when the phone is offline. Firebase traffic is never cached. */

const CACHE = 'pelotonhub-v2';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;   // Firebase, fonts, CDNs: straight to network
  e.respondWith(
    fetch(req, { cache: 'no-cache' })   // always revalidate: never mix old and new files
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req).then(hit => hit || caches.match('home.html')))
  );
});
