/* Ljubljana Reiseplaner – Service Worker
   Strategie:
     - Navigations-Anfragen (HTML)  → Network-first mit Navigation Preload, Fallback auf App-Shell im Cache
     - CDN-Libs (unpkg/jsdelivr/cdnjs) → Stale-while-revalidate
     - Karten-Tiles (raster) → Cache mit max. 400 Einträgen
     - Alles andere (Overpass/ORS/Photon/Nominatim/Open-Meteo) → Network-only,
       damit das Offline-Verhalten der App (Banner + Cache in IndexedDB) unverändert greift.
   Phrasebook-Daten sind inline in der HTML → werden mit dem App-Shell mitgecacht,
   d. h. der Sprachführer ist offline verfügbar.

   Versionierung: BUILD hochzählen, wenn sich App-Shell oder Cache-Struktur ändern.
*/

const BUILD = '2026-04-16-1';
const SHELL_VERSION = `lj-shell-${BUILD}`;
const LIBS_VERSION  = `lj-libs-${BUILD}`;
const TILES_VERSION = `lj-tiles-${BUILD}`;

const SHELL_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './apple-touch-icon.png',
  './favicon.ico',
  // Leaflet-Kern-Assets (schnell und offline-sinnvoll)
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js',
];

const LIB_HOSTS = new Set([
  'unpkg.com',
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
]);

const TILE_HOST_PATTERNS = [
  /\.basemaps\.cartocdn\.com$/,
  /\.tile\.openstreetmap\.org$/,
  /\.tile\.opentopomap\.org$/,
  /^server\.arcgisonline\.com$/,
  /\.waymarkedtrails\.org$/,
];

const API_HOSTS = new Set([
  'overpass-api.de',
  'overpass.kumi.systems',
  'api.openrouteservice.org',
  'router.project-osrm.org',
  'photon.komoot.io',
  'nominatim.openstreetmap.org',
  'api.open-meteo.com',
  'api.open-elevation.com',
]);

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_VERSION);
    // addAll würde bei CDN-Ausfall fehlschlagen → einzeln, Fehler schlucken
    await Promise.all(SHELL_URLS.map(u =>
      cache.add(new Request(u, { cache: 'reload' })).catch(() => {
        // no-cors fallback für opaque (z. B. CDN ohne CORS)
        return cache.add(new Request(u, { mode: 'no-cors' })).catch(() => {});
      })
    ));
    // Bewusst KEIN skipWaiting hier – wir warten auf User-Konsens (SKIP_WAITING-Message).
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Navigation Preload: schnelleres Laden der Navigationsanfragen
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable(); } catch(e) {}
    }
    // Alte Versionen wegräumen
    const keep = new Set([SHELL_VERSION, LIBS_VERSION, TILES_VERSION]);
    const names = await caches.keys();
    await Promise.all(names.filter(n => !keep.has(n)).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

function isTileRequest(url) {
  return TILE_HOST_PATTERNS.some(re => re.test(url.hostname));
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  for (let i = 0; i < keys.length - maxEntries; i++) {
    await cache.delete(keys[i]);
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch(e) { return; }

  // API-Anfragen: nie via SW-Cache – App hat eigene IndexedDB-Logik
  if (API_HOSTS.has(url.hostname)) return;

  // Navigation (HTML) → Network-first mit Preload, Fallback Shell
  if (req.mode === 'navigate' || (req.destination === 'document')) {
    event.respondWith((async () => {
      try {
        const preload = await event.preloadResponse;
        if (preload) {
          caches.open(SHELL_VERSION).then(c => c.put(req, preload.clone())).catch(() => {});
          return preload;
        }
        const fresh = await fetch(req);
        caches.open(SHELL_VERSION).then(c => c.put(req, fresh.clone())).catch(() => {});
        return fresh;
      } catch (e) {
        const cached = await caches.match(req)
          || await caches.match('./index.html')
          || await caches.match('./');
        if (cached) return cached;
        return new Response('<!doctype html><meta charset="utf-8"><title>Offline</title><h1>Offline</h1><p>App-Shell noch nicht gecacht. Bitte mit Netz einmal neu laden.</p>', {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503
        });
      }
    })());
    return;
  }

  // Tiles → Cache-first mit Trim
  if (isTileRequest(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(TILES_VERSION);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res && (res.status === 200 || res.type === 'opaque')) {
          cache.put(req, res.clone()).catch(() => {});
          event.waitUntil(trimCache(TILES_VERSION, 400));
        }
        return res;
      } catch (e) {
        return hit || new Response('', { status: 504 });
      }
    })());
    return;
  }

  // CDN-Libs → Stale-while-revalidate
  if (LIB_HOSTS.has(url.hostname)) {
    event.respondWith((async () => {
      const cache = await caches.open(LIBS_VERSION);
      const hit = await cache.match(req);
      const network = fetch(req).then(res => {
        if (res && res.status === 200) cache.put(req, res.clone()).catch(() => {});
        return res;
      }).catch(() => null);
      return hit || (await network) || new Response('', { status: 504 });
    })());
    return;
  }

  // Same-origin sonstiges → Cache-first, Netz-Fallback
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_VERSION);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res && res.status === 200) cache.put(req, res.clone()).catch(() => {});
        return res;
      } catch (e) {
        return new Response('', { status: 504 });
      }
    })());
  }
});

// Message-Protokoll zwischen App und SW
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (data.type === 'GET_BUILD') {
    event.ports[0] && event.ports[0].postMessage({ build: BUILD });
    return;
  }
  if (data.type === 'CLEAR_CACHES') {
    event.waitUntil((async () => {
      const names = await caches.keys();
      await Promise.all(names.map(n => caches.delete(n)));
      event.ports[0] && event.ports[0].postMessage({ ok: true });
    })());
    return;
  }
});
