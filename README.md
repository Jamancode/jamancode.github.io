# Ljubljana Reiseplaner

Offline-fähiger Mehrtages-Reiseplaner für Ljubljana. Läuft als **installierbare PWA** vollständig lokal im Browser: keine Cloud, keine Tracker, keine Cookies. Nur deine Trips, deine Favoriten, dein Sprachführer.

## Features

- **Karte & POIs** – Leaflet mit CARTO Voyager / Positron / OpenTopoMap / Esri Satellit; Kategorie-Chips für Essen, Kaffee, Sehenswürdigkeiten, Wanderungen, Übernachtung, ATMs, Apotheken …
- **Routing** – OpenRouteService (Fuß/Rad/E-Bike/Auto, mit Höhen) mit automatischem OSRM-Fallback.
- **Mehrtages-Plan** – Drag-Reorder, Öffnungszeiten-Check, Ankunfts-/Abfahrtzeiten, Wetter- und Regen-Überlagerung, Sonnenuntergang-Warnung.
- **Outdoor-Katalog** – kuratierte Wanderungen (Šmarna Gora, Rožnik, Tivoli, …) mit Distanz, Höhenmetern, Dauer.
- **Slowenisch-Sprachführer** – kategorisiert, mit Text-to-Speech.
- **PDF-Export** mit QR-Code für Trip-Transfer auf andere Geräte.
- **Offline** – Karten-Tiles (max. 400), App-Shell, Leaflet-Libs und der komplette Sprachführer bleiben im Service-Worker-Cache. Trips & Favoriten liegen in IndexedDB.
- **Installierbar** auf Desktop & Mobile. iOS: Teilen → „Zum Home-Bildschirm".

## Live

Sobald GitHub Pages aktiv ist:  
`https://<dein-user>.github.io/<dein-repo>/`

## Deploy auf GitHub Pages

1. Repo auf GitHub anlegen (z. B. `reiseplaner`), diesen Ordner pushen.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Der Workflow `.github/workflows/deploy.yml` läuft automatisch bei jedem Push auf `main`.
4. Nach ein paar Sekunden ist die App unter `https://<user>.github.io/<repo>/` live.

## ORS-API-Key einrichten (für präzises Routing)

1. Kostenlos registrieren: <https://openrouteservice.org/dev/#/signup>  
2. Dashboard → „Create Token" → Typ **Free** → Token kopieren.  
3. In der App beim ersten Start: Onboarding-Modal → Token einfügen → **Testen** → Speichern.  
4. Alternativ jederzeit: Zahnrad-Icon (oben rechts) → ORS-API-Key.

**Was passiert mit dem Key?**  
Er wird ausschließlich lokal in deinem Browser (IndexedDB) gespeichert und nur an `api.openrouteservice.org` gesendet. Keine Cloud, kein Log, kein 3rd-Party-Tracking.

Ohne Key funktioniert alles – es wird dann OSRM als Fallback genutzt (Fuß/Rad/Auto, keine Höhenprofile).

## Lokal testen

```bash
# einfacher Python-Server
python -m http.server 8080
# oder Node:
npx serve .
```

Dann <http://localhost:8080/> öffnen. Der Service-Worker registriert sich nur auf `http://` oder `https://`, nicht auf `file://`.

### PWA-Checks

- Chrome DevTools → Application → Manifest, Service Workers, Cache Storage
- Lighthouse → PWA ≥ 90, Accessibility ≥ 95

## Tests

```bash
npm install          # installiert Playwright
npm run test:unit    # Pure-Logic-Tests in tests.html
npm run test:e2e     # Playwright-Smoketest
```

CI-Workflow: `.github/workflows/test.yml`

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` | Single-file App (HTML/CSS/JS) |
| `sw.js` | Service Worker (Navigation-Preload, Tile-/Libs-/Shell-Cache) |
| `manifest.webmanifest` | PWA-Manifest |
| `icon.svg`, `apple-touch-icon.png`, `favicon.ico` | App-Icons |
| `app-logic.js` | Pure-Logic-Export für Tests *(wird in Phase F erzeugt)* |
| `tests.html`, `tests/` | Browser-Test-Harness + Playwright-E2E |
| `.github/workflows/` | Deploy + Tests auf GitHub Actions |
| `.nojekyll`, `robots.txt` | GH-Pages-Bootstrap |

## Attribution

- Karten & POIs © [OpenStreetMap](https://www.openstreetmap.org/copyright)-Mitwirkende
- Topo: [OpenTopoMap](https://opentopomap.org) · Satellit: [Esri](https://www.esri.com/) · Voyager/Positron: [CARTO](https://carto.com/attributions)
- Wanderwege: [Waymarked Trails](https://waymarkedtrails.org)
- Routing: [OpenRouteService](https://openrouteservice.org) / [OSRM](http://project-osrm.org/)
- Geocoding: [Nominatim](https://nominatim.org/) · [Photon](https://photon.komoot.io/)
- Wetter: [Open-Meteo](https://open-meteo.com)
- Fonts: [Fraunces](https://fonts.google.com/specimen/Fraunces) · [DM Sans](https://fonts.google.com/specimen/DM+Sans) · [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono)

## Lizenz

MIT — siehe [LICENSE](LICENSE).
