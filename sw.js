// Service worker — Terraza Sol & Sombra
const CACHE = 'terraza-v1';
const CORE = ['./', './terraza-sol-sombra.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // APIs de datos: siempre red, nunca cache (Overpass, Nominatim)
  if (url.hostname.includes('overpass') || url.hostname.includes('nominatim')) {
    return; // pasa directo a la red
  }

  // Tiles del mapa: red primero, cache de respaldo
  if (url.hostname.includes('basemaps.cartocdn.com')) {
    e.respondWith(
      fetch(e.request)
        .then(r => {
          const clone = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return r;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Resto (app, fuentes, Leaflet): cache primero, red de respaldo
  e.respondWith(
    caches.match(e.request).then(r =>
      r || fetch(e.request).then(resp => {
        const clone = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return resp;
      })
    )
  );
});
