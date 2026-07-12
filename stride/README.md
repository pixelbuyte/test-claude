# Stride 🏃

A Strava-style activity tracker, built as an installable Progressive Web App —
fully static, no build step, no backend, no API keys.

**Open `stride/index.html`** (or serve the repo and visit `/stride/`). On a phone,
use your browser's **Add to Home Screen / Install app** — Stride installs with its own
icon, launches standalone (no browser chrome), and the app shell works offline.

## What's inside

- **Live GPS recording** — press *Record → Track with GPS → Start* and Stride tracks
  your actual run/ride with the Geolocation API: live timer, distance, pace, a moving
  map trail, pause/resume, and a screen wake lock while tracking. Finish saves it as a
  full activity with route, splits and elevation. (Needs HTTPS + location permission.)
- **Feed** — activity cards for you and your club with route thumbnails, kudos and comments.
- **Activity detail** — interactive OpenStreetMap route (Leaflet), per-km splits with pace
  bars, and an elevation profile whose crosshair moves a live marker along the map route.
- **Record** — log an activity manually, or *draw a route on the map* (click to drop
  points; distance is measured along the line with the haversine formula).
- **Progress** — this-week stat tiles with deltas vs last week, a 16-week distance chart
  with hover/keyboard tooltips and a table view, and personal records. Sport filters
  scope everything on the page.
- **Profile** — lifetime totals and achievement badges derived from your data, plus a
  demo-data reset.

## How it works

| File | Role |
|------|------|
| `index.html` | Shell: top bar, mobile bottom nav, view container, PWA + script wiring |
| `styles.css` | The whole look — light theme, orange accent |
| `data.js` | Seeded demo data: hand-crafted San Francisco routes densified into GPS-like streams (Chaikin smoothing, elevation noise, slope-aware pacing), plus the localStorage store |
| `app.js` | Hash router, all five views, hand-rolled SVG charts, Leaflet integration, live GPS tracker |
| `manifest.webmanifest`, `sw.js`, `icons/` | PWA install + offline app shell |

Everything you do (recorded activities, kudos, comments) persists in `localStorage`
under `stride:v1`. "Reset demo data" on the Profile page starts fresh.

Maps need network access for OpenStreetMap tiles; without it the app still works and
activity routes fall back to inline SVG renderings.
