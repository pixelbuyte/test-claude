# Vertigo Rush

An original 3D parkour racing game that runs in a mobile browser. No build step,
no bundler, no external assets — open `index.html` from a static server and play.

```bash
npm test                     # 68 tests, zero dependencies
npx http-server . -p 8080    # ES modules need a server; file:// will not work
npm run smoke                # headless Chromium playthrough + screenshots
```

## The one structural rule

`src/sim/**` and `src/data/**` are **pure JavaScript**. They never import
three.js, never touch the DOM, and never call `Math.random`, `Date.now` or
`performance`. All gameplay truth lives there; `render/`, `input/` and `app/`
consume it.

That split is not tidiness. It is what lets a whole race be simulated headlessly
in Node, what keeps recorded times comparable across devices, and what makes the
parkour system testable without a browser. `test/purity.test.js` enforces it by
scanning source, because one stray `Math.random()` in the simulation would
silently invalidate every best time ever recorded.

The bridge between the two halves is an **event ring buffer**
(`src/sim/core/events.js`): the simulation pushes flat records, the view drains
them once per rendered frame. The simulation never calls a renderer or plays a
sound.

## How the simulation works

- **X lateral, Y up, Z forward.** Monotonic Z carries the race ranking and the
  broadphase index.
- **Fixed 60 Hz.** `stepRacer` takes no `dt` at all — `STEP` is a module
  constant. Rendering interpolates between the last two states, so motion is
  smooth at any refresh rate while physics stays identical.
- **Everything is an AABB.** Every collider is axis-aligned, so a single-axis
  sweep is exact and branch-free. Resolution order is fixed **Y → Z → X**: Y
  first so ground contact is known before anything moves horizontally, Z second
  because a forward hit is either a vault or a crash, X last because a lateral
  hit clamps rather than kills.
- **Broadphase is a Z-bucketed CSR grid**, counting-sorted once at load. Queries
  write into a caller-owned `Int32Array` and allocate nothing.
- **Moving platforms are a pure function of tick count**, never integrated, so a
  respawn restores them exactly with no rollback machinery.

## Parkour

Each substep, `affordances.js` runs a fixed set of cheap masked overlap queries
and reports what is physically nearby — vaultable, blocker, slide gap, wall left
and right, ledge, gap distance, launch pad. It decides nothing.
`ParkourController.js` turns that into actions.

The design promise is that **no move needs pixel-perfect timing**:

- **Free actions** — vault, mantle, launch pad — fire on their own at speed.
- **Hard actions** — double jump, wall-jump, slide — need input, but a press is
  buffered for 0.15 s and a takeoff is forgiven for 0.12 s after leaving the
  ground, so early and late inputs both land.
- **One button is contextual.** The same tap becomes a vault, a wall-jump or a
  plain jump depending on what is in front of the runner at that instant.

Every tunable lives in `src/config.js`, which the level validator also reads — so
retuning a jump re-validates every level rather than silently breaking one.

## Layout

```
src/config.js              every tunable + analytic reachability helpers
src/sim/math/              vec3 (out-param), scalar, seeded sfc32 PRNG
src/sim/core/              event ring, pool, fixed-step accumulator, checksum
src/sim/world/             ColliderSet (SoA), broadphase, sweep, World
src/sim/player/            movement, affordances, parkour state machine
src/sim/camera/            chase camera as pure numbers
src/sim/level/             LevelBuilder
src/sim/testing/rig.js     headless single-racer harness
src/data/                  themes, levels — pure data
src/render/                Renderer, SceneBuilder, boxMerge, CharacterView
src/input/                 touch + keyboard, normalised to one intent shape
src/app/RaceSession.js     the seam where sim and view meet
tools/smoke.mjs            headless browser playthrough
```

## Status

Playable practice track: running, jumping, vaulting, sliding, wall-running,
wall-jumping, mantling, launch pads, coins, checkpoints and respawns, with a
chase camera and a working HUD in both portrait and landscape.

Still to come: the chunk kit and level assembler, AI opponents and the race
manager, power-ups, progression and save, the full menu flow, audio, and the
keyframed animation system (the character rig is posed procedurally for now).

## Not included, rather than faked

No online leaderboards or multiplayer. No GLTF or texture pipeline — all
geometry, animation and UI are procedural and original. No IAP or ads.
