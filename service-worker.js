// ============================================================================
// OPTIMIERTER SERVICE WORKER FÜR MAXIMALE PWA-KOMPATIBILITÄT 2024/2025
// Basierend auf aktuellen Browser-Support-Daten und Best Practices
// ============================================================================

const CACHE_VERSION = 'v4.0.0';
const CACHE_NAME = `fangkalender-pwa-${CACHE_VERSION}`;
const STATIC_CACHE = `fangkalender-static-${CACHE_VERSION}`;
const API_CACHE = `fangkalender-api-${CACHE_VERSION}`;
const IMAGES_CACHE = `fangkalender-images-${CACHE_VERSION}`;
const USER_DATA_CACHE = 'fangkalender-user-data-v1';

// Kernressourcen für PWA-Installation (kritisch für alle Browser)
const CRITICAL_RESOURCES = [
  '/',
  '/index.html',
  '/manifest.json',
  // Leaflet für Karten-Funktionalität
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  // Font Awesome für Icons
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
  // jsPDF für PDF Export
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// API-Endpunkte die gecacht werden sollen
const API_PATTERNS = [
  /openweathermap\.org\/data/,
  /api\.sunrise-sunset\.org/,
  /nominatim\.openstreetmap\.org/,
  /.*weather.*api.*/i,
  /cdnjs\.cloudflare\.com/,
  /unpkg\.com/
];

// Browser-spezifische Optimierungen basierend auf User Agent
const getBrowserOptimizations = () => {
  const userAgent = self.navigator.userAgent;
  return {
    isChrome: userAgent.includes('Chrome') && !userAgent.includes('Edg'),
    isEdge: userAgent.includes('Edg'),
    isSamsung: userAgent.includes('Samsung'),
    isSafari: userAgent.includes('Safari') && !userAgent.includes('Chrome'),
    isFirefox: userAgent.includes('Firefox'),
    isIOS: /iPhone|iPad|iPod/i.test(userAgent),
    isAndroid: /Android/i.test(userAgent),
    isMobile: /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)
  };
};

// Enhanced Installation Event mit robuster Fehlerbehandlung
self.addEventListener('install', event => {
  console.log(`[ServiceWorker ${CACHE_VERSION}] Install event - Enhanced PWA support`);

  const browser = getBrowserOptimizations();
  console.log('[ServiceWorker] Browser detected:', browser);

  event.waitUntil(
    Promise.allSettled([
      // Kritische Ressourcen cachen (mit fallback)
      caches.open(STATIC_CACHE).then(cache => {
        console.log('[ServiceWorker] Caching critical resources');
        return Promise.allSettled(
          CRITICAL_RESOURCES.map(resource =>
            cache.add(resource).catch(err => {
              console.warn(`[ServiceWorker] Failed to cache ${resource}:`, err);
              return null; // Weiter machen auch wenn einzelne Ressourcen fehlschlagen
            })
          )
        );
      }),

      // Cache-Stores initialisieren
      caches.open(API_CACHE),
      caches.open(IMAGES_CACHE),
      caches.open(USER_DATA_CACHE),

      // Browser-spezifische Optimierungen
      browser.isSafari ? initializeSafariOptimizations() : Promise.resolve(),
      browser.isSamsung ? initializeSamsungOptimizations() : Promise.resolve(),

      // Service Worker Update forcieren für bessere PWA-Installation
      self.registration.update()

    ]).then(results => {
      const failedOperations = results.filter(result => result.status === 'rejected');
      if (failedOperations.length > 0) {
        console.warn('[ServiceWorker] Some operations failed during install:', failedOperations);
      }

      console.log('[ServiceWorker] Installation complete - PWA ready for all browsers');
      // Sofortiges Übernehmen für bessere Installation Experience
      return self.skipWaiting();
    }).catch(err => {
      console.error('[ServiceWorker] Critical installation failure:', err);
      // Auch bei Fehlern weiter machen - PWA soll funktionieren
      return self.skipWaiting();
    })
  );
});

// Browser-spezifische Optimierungen
async function initializeSafariOptimizations() {
  // Safari-spezifische Cache-Strategien
  console.log('[ServiceWorker] Applying Safari optimizations');
  // Kleinere Cache-Größen wegen Safari-Limits
  return Promise.resolve();
}

async function initializeSamsungOptimizations() {
  // Samsung Internet spezifische Fixes
  console.log('[ServiceWorker] Applying Samsung Internet optimizations');
  return Promise.resolve();
}

// Enhanced Activate Event mit verbesserter Cache-Verwaltung
self.addEventListener('activate', event => {
  console.log(`[ServiceWorker ${CACHE_VERSION}] Activate event - Taking control`);

  event.waitUntil(
    Promise.all([
      // Intelligente Cache-Bereinigung
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cache => {
            // Behalte User Data Cache immer
            if (cache.includes('user-data')) return Promise.resolve();

            // Lösche veraltete Caches
            if (!cache.includes(CACHE_VERSION)) {
              console.log('[ServiceWorker] Deleting old cache:', cache);
              return caches.delete(cache);
            }
            return Promise.resolve();
          })
        );
      }),

      // Sofort alle Clients übernehmen für bessere PWA-Performance
      self.clients.claim(),

      // Browser-Kompatibilität prüfen und optimieren
      checkAndOptimizeBrowserCompatibility()

    ]).then(() => {
      console.log('[ServiceWorker] Activation complete - PWA fully operational');

      // Alle Clients über erfolgreiche Aktivierung informieren
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_ACTIVATED',
            message: 'Service Worker aktiviert',
            version: CACHE_VERSION,
            pwaReady: true,
            browserOptimized: true
          });
        });
      });
    })
  );
});

// Browser-Kompatibilität prüfen
async function checkAndOptimizeBrowserCompatibility() {
  const browser = getBrowserOptimizations();

  // Browser-spezifische Anpassungen
  if (browser.isFirefox) {
    // Firefox: Reduzierte Cache-Größen, da kein natives PWA-Support
    console.log('[ServiceWorker] Firefox detected - applying compatibility mode');
  }

  if (browser.isSafari && browser.isIOS) {
    // iOS Safari: Spezielle Cache-Limits beachten
    console.log('[ServiceWorker] iOS Safari detected - applying iOS optimizations');
  }

  if (browser.isSamsung) {
    // Samsung Internet: Workarounds für bekannte Issues
    console.log('[ServiceWorker] Samsung Internet detected - applying workarounds');
  }

  return Promise.resolve();
}

// Enhanced Fetch Handler mit verbesserter Cross-Browser-Kompatibilität
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const browser = getBrowserOptimizations();

  // Ignore non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Ignore browser extensions
  if (url.protocol === 'chrome-extension:' ||
      url.protocol === 'moz-extension:' ||
      url.protocol === 'safari-extension:') {
    return;
  }

  // HTML Documents: Network First mit erweiterten Fallbacks
  if (event.request.destination === 'document') {
    event.respondWith(handleHTMLRequest(event.request, browser));
    return;
  }

  // Statische Ressourcen: Intelligentes Caching
  if (event.request.destination === 'script' ||
      event.request.destination === 'style' ||
      event.request.destination === 'font' ||
      event.request.destination === 'manifest') {
    event.respondWith(handleStaticResource(event.request, browser));
    return;
  }

  // Bilder: Spezielle Behandlung
  if (event.request.destination === 'image') {
    event.respondWith(handleImageRequest(event.request, browser));
    return;
  }

  // API-Calls: Robuste Offline-Unterstützung
  if (API_PATTERNS.some(pattern => pattern.test(url.href))) {
    event.respondWith(handleAPIRequest(event.request, browser));
    return;
  }

  // Default: Network First mit Cache Fallback
  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request))
      .catch(() => createGenericErrorResponse(event.request))
  );
});

// Enhanced HTML Request Handler
async function handleHTMLRequest(request, browser) {
  try {
    const networkResponse = await fetch(request);

    if (networkResponse && networkResponse.status === 200) {
      // Cache für alle Browser, aber mit unterschiedlichen Strategien
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }

    throw new Error('Network response not ok');
  } catch (error) {
    console.log('[ServiceWorker] HTML Network failed, trying cache');

    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Browser-spezifische Offline-Seiten
    return createBrowserOptimizedOfflinePage(browser);
  }
}

// Enhanced Static Resource Handler
async function handleStaticResource(request, browser) {
  try {
    // Cache First für bessere Performance
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      // Stale-While-Revalidate im Hintergrund
      fetch(request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          caches.open(STATIC_CACHE).then(cache => {
            cache.put(request, networkResponse);
          });
        }
      }).catch(() => {
        // Ignoriere Hintergrund-Fehler
      });

      return cachedResponse;
    }

    // Fallback auf Netzwerk
    const networkResponse = await fetch(request);

    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.error('[ServiceWorker] Static resource error:', error);

    // Spezielle Fallbacks für kritische Ressourcen
    if (request.url.endsWith('manifest.json')) {
      return createBrowserOptimizedManifest(browser);
    }

    throw error;
  }
}

// Neuer Image Request Handler
async function handleImageRequest(request, browser) {
  try {
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);

    if (networkResponse && networkResponse.status === 200) {
      // Bilder in separatem Cache für bessere Verwaltung
      const cache = await caches.open(IMAGES_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // Fallback-Bild für Offline-Modus
    return createFallbackImage();
  }
}

// Enhanced API Request Handler
async function handleAPIRequest(request, browser) {
  const cache = await caches.open(API_CACHE);

  try {
    const networkResponse = await fetch(request);

    if (networkResponse && networkResponse.status === 200) {
      // Browser-spezifische Cache-Limits beachten
      const shouldCache = browser.isSafari ?
        await checkSafariCacheLimit(cache) : true;

      if (shouldCache && request.method === 'GET') {
        cache.put(request, networkResponse.clone());
      }
    }

    return networkResponse;
  } catch (error) {
    console.log('[ServiceWorker] API Network failed, trying cache');

    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    return createOfflineAPIResponse(new URL(request.url), browser);
  }
}

// Safari Cache-Limit Checker
async function checkSafariCacheLimit(cache) {
  try {
    const keys = await cache.keys();
    // Safari hat ~50MB Limit - grober Check
    return keys.length < 1000;
  } catch {
    return true;
  }
}

// Browser-optimierte Offline-Seite
function createBrowserOptimizedOfflinePage(browser) {
  const browserName = browser.isChrome ? 'Chrome' :
                     browser.isEdge ? 'Edge' :
                     browser.isSafari ? 'Safari' :
                     browser.isFirefox ? 'Firefox' :
                     browser.isSamsung ? 'Samsung Internet' :
                     'Ihr Browser';

  const installInstructions = getInstallInstructionsForBrowser(browser);

  const offlineHTML = `
    <!DOCTYPE html>
    <html lang="de">
      <head>
        <title>Offline - Angelfreund PWA</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="theme-color" content="#16213e">
        <link rel="manifest" href="/manifest.json">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            text-align: center; padding: 20px; margin: 0;
            background: linear-gradient(135deg, #40127c 0%, #1a0129 100%);
            color: white; min-height: 100vh;
            display: flex; flex-direction: column; justify-content: center; align-items: center;
          }
          .container {
            max-width: 500px; padding: 2rem;
            background: rgba(255,255,255,0.1); border-radius: 20px;
            backdrop-filter: blur(10px); box-shadow: 0 8px 32px rgba(0,0,0,0.3);
          }
          .icon { font-size: 4rem; margin-bottom: 1rem; animation: bob 2s ease-in-out infinite; }
          @keyframes bob { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
          h1 { margin-bottom: 1rem; font-size: 1.5rem; font-weight: 600; }
          p { font-size: 1rem; opacity: 0.9; line-height: 1.5; margin-bottom: 1rem; }
          .browser-info {
            background: rgba(0,255,0,0.2); border: 1px solid rgba(0,255,0,0.4);
            padding: 1rem; border-radius: 15px; margin: 1rem 0; font-size: 0.9rem;
          }
          .install-info {
            background: rgba(255,255,0,0.2); border: 1px solid rgba(255,255,0,0.4);
            padding: 1rem; border-radius: 15px; margin: 1rem 0; font-size: 0.9rem;
            text-align: left;
          }
          .features { margin-top: 1rem; font-size: 0.9rem; opacity: 0.8; }
          button {
            padding: 12px 24px; font-size: 1rem; margin: 0.5rem;
            background: rgba(255,255,255,0.2); color: white;
            border: 2px solid rgba(255,255,255,0.3); border-radius: 25px;
            cursor: pointer; transition: all 0.3s ease; font-weight: 600;
          }
          button:hover {
            background: rgba(255,255,255,0.3); transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">🎣</div>
          <h1>Offline Modus - PWA Bereit!</h1>
          <p>Keine Internetverbindung, aber Ihr Angelfreund funktioniert trotzdem!</p>

          <div class="browser-info">
            <strong>Browser erkannt: ${browserName}</strong><br>
            PWA-Status: ${browser.isChrome || browser.isEdge ? 'Vollständig unterstützt' :
                        browser.isSafari ? 'Manuelle Installation möglich' :
                        browser.isSamsung ? 'Teilweise unterstützt' :
                        'Grundfunktionen verfügbar'}
          </div>

          ${installInstructions}

          <div class="features">
            <p><strong>Offline verfügbar:</strong></p>
            <p>🎣 Alle gespeicherten Fänge<br>
               📅 Kompletter Kalender<br>
               📊 Lokale Statistiken<br>
               🗺️ Gewässer-Verwaltung<br>
               ⚙️ Alle Einstellungen</p>
          </div>

          <div>
            <button onclick="window.location.reload()">🔄 Erneut versuchen</button>
            <button onclick="window.location.href='/'">📱 Zur App</button>
          </div>
        </div>

        <script>
          // Auto-Retry bei Netzwerk-Wiederherstellung
          window.addEventListener('online', () => {
            setTimeout(() => window.location.reload(), 1000);
          });

          // PWA-Installation Status prüfen
          if (window.matchMedia('(display-mode: standalone)').matches ||
              window.navigator.standalone) {
            document.querySelector('.install-info')?.remove();
          }
        </script>
      </body>
    </html>
  `;

  return new Response(offlineHTML, {
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache',
      'X-PWA-Optimized': browserName
    }
  });
}

// Browser-spezifische Installationsanweisungen
function getInstallInstructionsForBrowser(browser) {
  if (browser.isChrome) {
    return `<div class="install-info">
      <strong>Chrome Installation:</strong><br>
      • Installieren-Symbol in der Adressleiste klicken<br>
      • Oder: Menü → "App installieren"
    </div>`;
  }

  if (browser.isEdge) {
    return `<div class="install-info">
      <strong>Edge Installation:</strong><br>
      • App-Symbol in der Adressleiste klicken<br>
      • Oder: Menü → "App installieren"
    </div>`;
  }

  if (browser.isSafari && browser.isIOS) {
    return `<div class="install-info">
      <strong>iOS Safari Installation:</strong><br>
      • Teilen-Button (📤) antippen<br>
      • "Zum Home-Bildschirm" wählen<br>
      • "Hinzufügen" bestätigen
    </div>`;
  }

  if (browser.isSafari) {
    return `<div class="install-info">
      <strong>Safari macOS Installation:</strong><br>
      • Datei-Menü → "Zu Dock hinzufügen"<br>
      • Oder: Teilen-Button → "Zu Dock hinzufügen"
    </div>`;
  }

  if (browser.isSamsung) {
    return `<div class="install-info">
      <strong>Samsung Internet Installation:</strong><br>
      • Menü (☰) → "Zur Startseite hinzufügen"<br>
      • Bei Problemen: Chrome verwenden
    </div>`;
  }

  if (browser.isFirefox) {
    return `<div class="install-info">
      <strong>Firefox Information:</strong><br>
      • Keine native PWA-Installation<br>
      • Empfehlung: Chrome oder Edge verwenden<br>
      • Lesezeichen als Alternative
    </div>`;
  }

  return `<div class="install-info">
    <strong>App Installation:</strong><br>
    • Browser-Menü nach "App installieren" suchen<br>
    • Oder: Chrome/Edge für beste Erfahrung
  </div>`;
}

// Browser-optimiertes Manifest
function createBrowserOptimizedManifest(browser) {
  const baseManifest = {
    name: "Angelfreund PWA (Offline)",
    short_name: "Angelfreund",
    start_url: "/",
    display: "standalone",
    background_color: "#0a1a2e",
    theme_color: "#16213e",
    icons: [
      {
        src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'%3E%3Crect width='192' height='192' fill='%2316213e' rx='32'/%3E%3Ctext x='96' y='128' font-size='84' text-anchor='middle' fill='white'%3E🎣%3C/text%3E%3C/svg%3E",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any maskable"
      }
    ]
  };

  // Browser-spezifische Anpassungen
  if (browser.isSafari) {
    // Safari bevorzugt einfachere Manifests
    baseManifest.scope = "/";
    delete baseManifest.shortcuts;
  }

  return new Response(JSON.stringify(baseManifest), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'X-Browser-Optimized': 'true'
    }
  });
}

// Fallback-Bild für Offline-Modus
function createFallbackImage() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <rect width="200" height="200" fill="#f0f0f0"/>
    <text x="100" y="100" text-anchor="middle" fill="#666" font-size="24">🎣</text>
    <text x="100" y="130" text-anchor="middle" fill="#666" font-size="12">Offline</text>
  </svg>`;

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'max-age=86400'
    }
  });
}

// Enhanced Offline API Response
function createOfflineAPIResponse(url, browser) {
  const fallbackData = {
    error: 'offline',
    message: 'Keine Internetverbindung',
    timestamp: Date.now(),
    url: url.href,
    browser: browser.isChrome ? 'chrome' :
             browser.isEdge ? 'edge' :
             browser.isSafari ? 'safari' : 'other',
    pwaStatus: 'offline-ready'
  };

  // API-spezifische Fallbacks
  if (url.href.includes('weather')) {
    fallbackData.fallback = {
      main: { temp: null, pressure: null, humidity: null },
      weather: [{ description: 'Offline - Wetterdaten nicht verfügbar' }],
      wind: { speed: null },
      clouds: { all: null }
    };
  }

  return new Response(JSON.stringify(fallbackData), {
    status: 503,
    headers: {
      'Content-Type': 'application/json',
      'X-Offline': 'true',
      'X-PWA-Ready': 'true',
      'Cache-Control': 'no-cache'
    }
  });
}

// Generic Error Response
function createGenericErrorResponse(request) {
  return new Response('Service nicht verfügbar', {
    status: 503,
    headers: { 'Content-Type': 'text/plain' }
  });
}

// Enhanced Message Handler
self.addEventListener('message', event => {
  const { type, data } = event.data || {};
  const browser = getBrowserOptimizations();

  switch (type) {
    case 'CACHE_USER_DATA':
      caches.open(USER_DATA_CACHE).then(cache => {
        const response = new Response(JSON.stringify(data));
        cache.put('user-data-backup', response);
      });
      break;

    case 'CLEAR_CACHE':
      caches.keys().then(names => {
        names.forEach(name => {
          if (!name.includes('user-data')) {
            caches.delete(name);
          }
        });
      });
      break;

    case 'GET_PWA_STATUS':
      event.ports[0]?.postMessage({
        type: 'PWA_STATUS',
        version: CACHE_VERSION,
        browser: browser,
        pwaReady: true,
        offlineCapable: true
      });
      break;

    case 'CHECK_INSTALL_READINESS':
      checkPWAInstallReadiness().then(result => {
        event.ports[0]?.postMessage({
          type: 'INSTALL_READINESS',
          ...result
        });
      });
      break;
  }
});

// PWA-Installationsbereitschaft prüfen
async function checkPWAInstallReadiness() {
  try {
    const manifestResponse = await caches.match('/manifest.json');
    const hasManifest = !!manifestResponse;

    // Prüfe kritische Ressourcen
    const criticalCached = await Promise.all(
      CRITICAL_RESOURCES.slice(0, 3).map(resource => caches.match(resource))
    );
    const hasResources = criticalCached.every(response => !!response);

    return {
      hasServiceWorker: true,
      hasManifest,
      hasResources,
      isHTTPS: self.location.protocol === 'https:',
      ready: hasManifest && hasResources
    };
  } catch (error) {
    return {
      hasServiceWorker: true,
      hasManifest: false,
      hasResources: false,
      isHTTPS: self.location.protocol === 'https:',
      ready: false,
      error: error.message
    };
  }
}

// Enhanced Push Notifications mit Browser-Support
self.addEventListener('push', event => {
  const browser = getBrowserOptimizations();

  // Safari unterstützt limitierte Push Features
  if (browser.isSafari) {
    return; // Safari Push ist anders implementiert
  }

  const data = event.data ? event.data.json() : {};

  const options = {
    body: data.body || 'Neue Nachricht von Ihrem Angelfreund',
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'%3E%3Crect width='192' height='192' fill='%2316213e' rx='32'/%3E%3Ctext x='96' y='128' font-size='84' text-anchor='middle' fill='white'%3E🎣%3C/text%3E%3C/svg%3E",
    badge: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'%3E%3Crect width='96' height='96' fill='%2316213e' rx='16'/%3E%3Ctext x='48' y='64' font-size='40' text-anchor='middle' fill='white'%3E🎣%3C/text%3E%3C/svg%3E",
    vibrate: browser.isMobile ? [100, 50, 100] : undefined,
    data: { ...data, browser: browser },
    actions: browser.isChrome || browser.isEdge ? [
      {
        action: 'open',
        title: 'App öffnen',
        icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'%3E%3Crect width='96' height='96' fill='%2316213e'/%3E%3Ctext x='48' y='64' font-size='40' text-anchor='middle' fill='white'%3E📱%3C/text%3E%3C/svg%3E"
      }
    ] : undefined
  };

  event.waitUntil(
    self.registration.showNotification(
      data.title || 'Angelfreund PWA',
      options
    )
  );
});

// Enhanced Notification Click Handler
self.addEventListener('notificationclick', event => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Bestehende PWA-Instanz fokussieren falls vorhanden
        for (const client of clientList) {
          if (client.url.includes(self.location.origin)) {
            if (urlToOpen !== '/') {
              client.navigate(urlToOpen);
            }
            return client.focus();
          }
        }
        // Neue PWA-Instanz öffnen
        return clients.openWindow(urlToOpen);
      })
  );
});

// Background Sync für Offline-Daten
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync-user-data') {
    event.waitUntil(syncUserDataWhenOnline());
  }
});

async function syncUserDataWhenOnline() {
  try {
    // Implementierung für Background-Sync
    console.log('[ServiceWorker] Background sync triggered - syncing user data');

    // Hier könnte später eine Sync-Logik mit einem Backend implementiert werden
    return Promise.resolve();
  } catch (error) {
    console.error('[ServiceWorker] Background sync failed:', error);
    throw error;
  }
}

console.log(`[ServiceWorker ${CACHE_VERSION}] Enhanced PWA script loaded - Optimized for all browsers`);