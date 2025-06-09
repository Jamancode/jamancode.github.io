const CACHE_NAME = 'fangkalender-pwa-cache-v1';
const STATIC_CACHE = 'fangkalender-static-v1';
const API_CACHE = 'fangkalender-api-v1';

const SAFARI_CACHE_LIMIT_BYTES = 40 * 1024 * 1024; // 40MB to be a bit safe under 50MB
const STATIC_CACHE_EVICTION_COUNT = 5; // Number of static items to evict if limit reached
const API_CACHE_EVICTION_COUNT = 10; // Number of API items to evict if limit reached

function isSafari() {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

async function getCacheUsage() {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    return estimate.usage || 0;
  }
  return 0; // Fallback if API not available
}

async function evictOldCacheItems(cacheNameToClean, evictionCount) {
  console.log(`ServiceWorker: Attempting to evict ${evictionCount} items from cache: ${cacheNameToClean}`);
  try {
    const cache = await caches.open(cacheNameToClean);
    const requests = await cache.keys();
    if (requests.length === 0) {
        console.log(`ServiceWorker: Cache ${cacheNameToClean} is empty, nothing to evict.`);
        return;
    }

    // For API_CACHE, try to evict based on stored timestamp if possible
    if (cacheNameToClean === API_CACHE && requests.length > evictionCount) {
        let itemsWithTimestamp = [];
        for (const request of requests) {
            const response = await cache.match(request);
            if (response) {
                try {
                    const data = await response.json(); // Assumes API responses are stored as JSON strings with a timestamp
                    itemsWithTimestamp.push({ request, timestamp: data.timestamp || 0 });
                } catch (e) {
                    // Not a JSON response or no timestamp, assign a default old timestamp
                    itemsWithTimestamp.push({ request, timestamp: 0 });
                }
            }
        }
        itemsWithTimestamp.sort((a, b) => a.timestamp - b.timestamp); // Sort oldest first
        const itemsToEvict = itemsWithTimestamp.slice(0, evictionCount);
        for (const item of itemsToEvict) {
            console.log(`ServiceWorker: Evicting (oldest API) ${item.request.url} from ${cacheNameToClean}`);
            await cache.delete(item.request);
        }
    } else if (requests.length > evictionCount) { // For STATIC_CACHE or if API_CACHE items aren't structured with timestamp
        const itemsToEvict = requests.slice(0, evictionCount); // Simple FIFO by array order (keys() doesn't guarantee order)
        for (const request of requests) {
            console.log(`ServiceWorker: Evicting (FIFO) ${request.url} from ${cacheNameToClean}`);
            await cache.delete(request);
        }
    } else {
         console.log(`ServiceWorker: Not enough items in ${cacheNameToClean} to evict ${evictionCount}. Evicting all ${requests.length} items.`);
         for (const request of requests) {
            console.log(`ServiceWorker: Evicting (all) ${request.url} from ${cacheNameToClean}`);
            await cache.delete(request);
        }
    }
  } catch (err) {
    console.error(`ServiceWorker: Error during cache eviction from ${cacheNameToClean}:`, err);
  }
}

async function ensureCacheLimits() {
  if (!isSafari()) {
    return;
  }
  try {
    const usage = await getCacheUsage();
    console.log(`ServiceWorker: Current estimated cache usage: ${(usage / (1024*1024)).toFixed(2)}MB`);
    if (usage > SAFARI_CACHE_LIMIT_BYTES) {
      console.warn(`ServiceWorker: Cache usage ${usage} exceeds Safari limit ${SAFARI_CACHE_LIMIT_BYTES}. Evicting items.`);
      // Evict from API cache first as it's generally more dynamic and might grow faster
      await evictOldCacheItems(API_CACHE, API_CACHE_EVICTION_COUNT);
      // Then, if still over (less likely with API eviction, but as a fallback)
      const newUsage = await getCacheUsage();
      if (newUsage > SAFARI_CACHE_LIMIT_BYTES) {
         await evictOldCacheItems(STATIC_CACHE, STATIC_CACHE_EVICTION_COUNT);
      }
    }
  } catch (err) {
    console.error('ServiceWorker: Error in ensureCacheLimits:', err);
  }
}

// Kernressourcen die IMMER verfügbar sein müssen.
// Hinweis: Externe CDN-Ressourcen (FontAwesome, Leaflet, jsPDF) werden nicht direkt hier gecacht.
// Ihre Offline-Verfügbarkeit hängt vom Browser-Caching oder dynamischem Caching ab.
const CRITICAL_RESOURCES = [
  'index.html',
  'manifest.json'
  // Entferne nicht-existierende Dateien erstmal
];

// API-Endpunkte die gecacht werden sollen
const API_PATTERNS = [
  /openweathermap\.org\/data/,
  /api\.sunrise-sunset\.org/,
  /.*weather.*api.*/i
];

// Install: Cache nur existierende kritische Ressourcen
self.addEventListener('install', event => {
  console.log('ServiceWorker: Install event');

  event.waitUntil(
    Promise.all([
      // Statische Ressourcen cachen
      caches.open(STATIC_CACHE).then(cache => {
        return cache.addAll(CRITICAL_RESOURCES);
      }),
      // API-Cache vorbereiten
      caches.open(API_CACHE)
    ]).then(() => {
      console.log('ServiceWorker: Installation complete');
      // Sofort übernehmen ohne auf andere Tabs zu warten
      self.skipWaiting();
    }).catch(err => {
      console.error('ServiceWorker: Installation failed:', err);
    })
  );
});

// Activate: Alte Caches bereinigen
self.addEventListener('activate', event => {
  console.log('ServiceWorker: Activate event');

  event.waitUntil(
    Promise.all([
      // Alte Caches löschen
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cache => {
            if (![STATIC_CACHE, API_CACHE].includes(cache)) {
              console.log('ServiceWorker: Deleting old cache:', cache);
              return caches.delete(cache);
            }
          })
        );
      }),
      // Sofort alle Clients übernehmen
      self.clients.claim()
    ])
  );
});

// Fetch: Intelligente Cache-Strategien
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Statische Ressourcen: Cache First
  if (event.request.destination === 'document' ||
      event.request.destination === 'script' ||
      event.request.destination === 'style' ||
      event.request.destination === 'image') {

    event.respondWith(handleStaticResource(event.request));
    return;
  }

  // API-Calls: Network First mit Cache Fallback + Stale-While-Revalidate
  if (API_PATTERNS.some(pattern => pattern.test(url.href))) {
    event.respondWith(handleAPIRequest(event.request));
    return;
  }

  // Alles andere: Network First
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});

// Cache First für statische Inhalte
async function handleStaticResource(request) {
  try {
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);

    if (networkResponse && networkResponse.status === 200) {
      await ensureCacheLimits(); // Check and manage cache size before adding new static resource
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.error('ServiceWorker: Static resource error:', error);

    // Offline-Fallback für HTML-Seiten
    if (request.destination === 'document') {
      return createOfflinePage();
    }

    throw error;
  }
}

// Network First mit intelligentem Caching für APIs
async function handleAPIRequest(request) {
  const cache = await caches.open(API_CACHE);
  const url = new URL(request.url);

  try {
    // Versuche Netzwerk-Request
    const networkResponse = await fetch(request);

    if (networkResponse && networkResponse.status === 200) {
      // Cache nur GET-Requests
      if (request.method === 'GET') {
        await ensureCacheLimits(); // Check and manage cache size before adding new API resource
        // API-Responses mit Zeitstempel versehen für Verfallslogik
        const responseClone = networkResponse.clone();
        const responseBody = await responseClone.json();

        const cachedData = {
          data: responseBody,
          timestamp: Date.now(),
          url: request.url
        };

        // Als JSON-Response mit Metadaten cachen
        const cachedResponse = new Response(JSON.stringify(cachedData), {
          headers: { 'Content-Type': 'application/json' }
        });

        cache.put(request, cachedResponse);
      }
    }

    return networkResponse;
  } catch (error) {
    console.log('ServiceWorker: Network failed, trying cache for:', request.url);

    // Fallback auf Cache
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      const cachedData = await cachedResponse.json();
      const age = Date.now() - cachedData.timestamp;
      const maxAge = 30 * 60 * 1000; // 30 Minuten

      if (age < maxAge) {
        // Cache ist noch frisch
        return new Response(JSON.stringify(cachedData.data), {
          headers: {
            'Content-Type': 'application/json',
            'X-Cache': 'HIT',
            'X-Cache-Age': Math.floor(age / 1000)
          }
        });
      } else {
        console.log('ServiceWorker: Cached API data too old, serving anyway (offline)');
        // Auch veraltete Daten sind besser als gar keine
        return new Response(JSON.stringify(cachedData.data), {
          headers: {
            'Content-Type': 'application/json',
            'X-Cache': 'STALE',
            'X-Cache-Age': Math.floor(age / 1000)
          }
        });
      }
    }

    // Letzter Fallback: Offline-API-Response
    return createOfflineAPIResponse(url);
  }
}

// Minimale Offline-Seite generieren
function createOfflinePage() {
  const offlineHTML = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Offline - Fangkalender</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 50px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            min-height: 100vh;
            margin: 0;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
          .offline-icon { font-size: 4rem; margin-bottom: 1rem; }
          h1 { margin-bottom: 1rem; }
          p { font-size: 1.1rem; opacity: 0.9; }
          button {
            margin-top: 2rem;
            padding: 12px 24px;
            font-size: 1rem;
            background: rgba(255,255,255,0.2);
            color: white;
            border: 2px solid white;
            border-radius: 25px;
            cursor: pointer;
            transition: all 0.3s ease;
          }
          button:hover {
            background: rgba(255,255,255,0.3);
            transform: translateY(-2px);
          }
        </style>
      </head>
      <body>
        <div class="offline-icon">🎣</div>
        <h1>Offline Modus - Fangkalender</h1>
        <p>Du bist momentan offline, aber deine gespeicherten Fänge sind weiterhin verfügbar!</p>
        <p>Wetterdaten und Bisswahrscheinlichkeiten können nicht aktualisiert werden.</p>
        <button onclick="window.location.reload()">🔄 Erneut versuchen</button>
      </body>
    </html>
  `;

  return new Response(offlineHTML, {
    headers: { 'Content-Type': 'text/html' }
  });
}

// Fallback für API-Anfragen im Offline-Modus
function createOfflineAPIResponse(url) {
  const fallbackData = {
    error: 'offline',
    message: 'Keine Internetverbindung verfügbar',
    timestamp: Date.now(),
    url: url.href
  };

  // Spezielle Fallbacks je nach API
  if (url.href.includes('weather')) {
    fallbackData.fallback = {
      temperature: null,
      humidity: null,
      pressure: null,
      description: 'Offline - Wetterdaten nicht verfügbar'
    };
  }

  return new Response(JSON.stringify(fallbackData), {
    status: 503,
    headers: {
      'Content-Type': 'application/json',
      'X-Offline': 'true'
    }
  });
}

// Message-Handler für Cache-Management von der App
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CACHE_FANG_DATA') {
    // Fangdaten in separatem Cache speichern
    caches.open('fangkalender-user-data').then(cache => {
      const response = new Response(JSON.stringify(event.data.data));
      cache.put('user-catches', response);
    });
  }

  if (event.data && event.data.type === 'CLEAR_API_CACHE') {
    caches.delete(API_CACHE).then(() => {
      caches.open(API_CACHE);
    });
  }
});
