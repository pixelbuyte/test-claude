# Stride 🏃

A Strava-style activity tracker, built as a fully static, self-contained web app —
no build step, no backend, no API keys.

**Open `stride/index.html`** (or serve the repo and visit `/stride/`).

## What's inside

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
| `index.html` | Shell: top bar, view container, Leaflet + script includes |
| `styles.css` | The whole look — light theme, orange accent |
| `data.js` | Seeded demo data: hand-crafted San Francisco routes densified into GPS-like streams (Chaikin smoothing, elevation noise, slope-aware pacing), plus the localStorage store |
| `app.js` | Hash router, all five views, hand-rolled SVG charts, Leaflet integration |

Everything you do (recorded activities, kudos, comments) persists in `localStorage`
under `stride:v1`. "Reset demo data" on the Profile page starts fresh.

Maps need network access for OpenStreetMap tiles; without it the app still works and
activity routes fall back to inline SVG renderings.
