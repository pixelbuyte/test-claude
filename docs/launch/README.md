# Launch video

`uprank-launch.mp4` — 59s, 1280×720, no audio.

It is recorded off the running app rather than assembled from mockups, so
every frame is the real UI at the real palette. The beats are:

1. Title card
2. The promise — published prices, no auctions, nobody can outbid you
3. Permanent Top 5, including the open ranks with their prices on them
4. Timed tiers, and first-come-first-served ordering inside a tier
5. The own/rent toggle, picking a tier and a duration
6. The single URL field, typed live
7. End card

## Re-recording it

Run the app on port 4182, then:

```
node docs/launch/record-launch-video.mjs
```

The script drives a Chromium session with Playwright's video recorder,
injecting a caption layer and a cursor puck over the live page. It needs
`OUT` set to a scratch directory, and it serves favicons from local PNGs
because this sandbox cannot reach Google's favicon host — on a normal
machine that route can be dropped.

Encode the resulting `.webm` with:

```
ffmpeg -y -ss 0.55 -i rec/*.webm \
  -vf "scale=1280:720:flags=lanczos,fps=30" \
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -movflags +faststart \
  uprank-launch.mp4
```

The `-ss 0.55` trims the blank frames before first paint.

The board on screen is demo data, and the "Demo data" banner is left visible
in the recording on purpose — the listings shown are not customers.
