// Teranga Resto - ouverture sans internet
const CACHE = 'teranga-resto-v1';
const BASE = [
  './',
  './index.html',
  './apple-touch-icon.png?v=1',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c =>
    Promise.all(BASE.map(u => c.add(u).catch(() => {})))
  ).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k.startsWith('teranga-resto-') && k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

function fromNetwork(req, ms) {
  return new Promise((ok, ko) => {
    const t = setTimeout(ko, ms);
    fetch(req).then(r => { clearTimeout(t); ok(r); }, e => { clearTimeout(t); ko(e); });
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Les donnees (Supabase) ne passent jamais par le cache
  if (url.hostname.endsWith('supabase.co') || url.hostname.endsWith('supabase.in')) return;

  // Pages : internet d'abord (version a jour), sinon la copie du telephone
  if (req.mode === 'navigate') {
    e.respondWith(
      fromNetwork(req, 6000).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return r;
      }).catch(() => caches.match(req, { ignoreSearch: true })
        .then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Images, polices, bibliotheque : la copie d'abord, mise a jour en arriere-plan
  const sameSite = url.origin === self.location.origin;
  const cdn = /jsdelivr\.net|unpkg\.com|fonts\.(googleapis|gstatic)\.com/.test(url.hostname);
  if (!sameSite && !cdn) return;
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(r => {
        if (r && (r.ok || r.type === 'opaque')) {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return r;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
