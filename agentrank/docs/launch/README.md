# Launch video

`urank-launch.mp4` — 48s, 1280×720, no audio.

Shot off the running app, not assembled from mockups, so it cannot drift from
what the site actually does. The camera moves; the page never scrolls.

## How it is built

`stage.html` is a film set. It puts the real site in an iframe inside a
floating browser card on the brand's warm ground, and exposes a camera rig:

- `__cam(x, y, scale)` — move the camera so page point `(x, y)` sits centred.
  It clamps with a little slack so a shot never runs off the page. The card is
  painted the page's own background colour precisely so that slack blends
  away — which is what lets an element hugging the page edge (the hero claim
  card) still be framed centrally instead of shoved to one side.
- `__cap(title, sub)` — the lower caption, over a cream scrim so it never
  collides with the board rows underneath.
- `__card(h, p, domain)` — the full-screen title and end cards.

`record-launch-video.mjs` drives it, moving the camera to coordinates measured
against a 1080×2400 viewport. If the layout moves, re-measure with a
`boundingBox()` pass and update the numbers.

Two things that are easy to trip over:

- The stage is `file://` while the site is `http://localhost`, so the parent
  cannot touch `contentDocument`. Playwright's frame handle can, which is how
  the dev badge gets hidden.
- Board rows are 1030px wide inside a 1080px page. Past roughly `scale: 1.05`
  a row gets cropped mid-word, so row-level shots stay near 1.0 and get their
  emphasis from the caption and the hold, not from tighter zoom.

## Beats

1. Title card
2. Wide on the hero — every placement has a published price
3. Push in on the claim card — no auctions, nobody can outbid you
4. Push in on the single URL field
5. Out to the board — permanent Top 5
6. An open rank with its price on the row
7. **Hold on the highlighted row** so the gold orbit reads
8. Timed tiers and their countdowns
9. Pull back — first come, first served
10. End card with the domain

## Re-recording

Run the app on port 4182, then:

```
OUT=<scratch-dir> node docs/launch/record-launch-video.mjs
```

`OUT` needs `stage.html` and the `fav-*.png` icons in it — the script serves
favicons from local files because this sandbox's headless Chromium cannot
reach Google's favicon host. On a normal machine that route can be dropped.

Encode with:

```
ffmpeg -y -ss 0.5 -i rec2/*.webm \
  -vf "scale=1280:720:flags=lanczos,fps=30" \
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -movflags +faststart \
  urank-launch.mp4
```

`-ss 0.5` trims the frames before first paint.

The board on screen is demo data, and the "Demo data" banner is left visible on
purpose — the listings shown are seeds, not customers.
