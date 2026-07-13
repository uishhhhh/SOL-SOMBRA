// Service worker — Terraza Sol & Sombra
// v2: cachés separadas, límite de teselas, network-first para el HTML,
// solo peticiones GET y solo respuestas correctas.

const APP_CACHE = 'terraza-app-v2';
const TILE_CACHE = 'terraza-tiles-v1';
const TILE_LIMIT = 300; // máximo de teselas guardadas
const CORE = ['./', './terraza-sol-sombra.html'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(APP_CACHE)
      .then(c => c.addAll(CORE))
      .catch(err => console.warn('[sw] precache falló:', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== APP_CACHE && k !== TILE_CACHE)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

/* Guarda en caché solo si la respuesta es válida */
async function putIfOk(cacheName, request, response) {
  if (!response || !response.ok) return;
  const c = await caches.open(cacheName);
  await c.put(request, response);
}

/* Limita el número de entradas de la caché de teselas (elimina las más antiguas) */
async function trimTileCache() {
  const c = await caches.open(TILE_CACHE);
  const keys = await c.keys();
  if (keys.length <= TILE_LIMIT) return;
  const excess = keys.length - TILE_LIMIT;
  for (let i = 0; i < excess; i++) await c.delete(keys[i]);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return; // nunca cachear operaciones no idempotentes

  const url = new URL(req.url);

  // APIs de datos y analítica: siempre red, nunca cache
  if (
    url.hostname.includes('overpass') ||
    url.hostname.includes('nominatim') ||
    url.hostname.includes('googletagmanager') ||
    url.hostname.includes('google-analytics')
  ) {
    return;
  }

  // Teselas del mapa: red primero, cache de respaldo, con límite de tamaño
  if (url.hostname.includes('basemaps.cartocdn.com')) {
    e.respondWith(
      fetch(req)
        .then(r => {
          const clone = r.clone();
          e.waitUntil(putIfOk(TILE_CACHE, req, clone).then(trimTileCache));
          return r;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Documento HTML: red primero (evita servir versiones viejas tras un despliegue)
  if (req.mode === 'navigate' || url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(req)
        .then(r => {
          const clone = r.clone();
          e.waitUntil(putIfOk(APP_CACHE, req, clone));
          return r;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./terraza-sol-sombra.html')))
    );
    return;
  }

  // Resto (Leaflet, fuentes): stale-while-revalidate
  e.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req)
        .then(r => {
          const clone = r.clone();
          e.waitUntil(putIfOk(APP_CACHE, req, clone));
          return r;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
