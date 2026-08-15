# Vertigo Rush

An original 3D parkour racing game that runs in a mobile browser. No build step,
no bundler, no external assets — open `index.html` from a static server and play.

```bash
npm test                     # 165 tests, zero dependencies
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
src/sim/level/             builder, chunk assembler, reachability, validator
src/sim/race/              RaceManager, headless race runner
src/sim/ai/                opponent brains
src/sim/systems/           power-ups
src/sim/save/              schema + SaveManager (storage adapter injected)
src/sim/anim/              clip sampling, blending, the blend tree
src/sim/testing/rig.js     headless single-racer harness
src/data/                  themes, levels, chunks, characters, rig, clips — pure
src/render/                Renderer, SceneBuilder, boxMerge, VFX, CharacterView
src/audio/                 procedural synth, SFX mapping, music beds
src/input/                 touch + keyboard, normalised to one intent shape
src/app/RaceSession.js     the seam where sim and view meet
tools/smoke.mjs            headless browser playthrough
```

## Levels

A level is data: theme, a **fixed seed**, a speed curve, an authored intro and a
seeded-procedural tail drawn from the chunk kit. The seed is content, not a
detail - the same seed always produces the same course.

A chunk is **static data, never a generator function**. That is what makes
completability provable: a finite set of shapes is validated once, and the
assembler may only concatenate validated shapes. Variety comes from selection,
X-mirroring and pacing rules.

Generation is **total** - when no candidate satisfies the connection contract
(lanes must meet, heights must match, projected speed must clear the chunk's
minimum), a guaranteed-admissible fallback chunk is placed instead.

Gaps declare **how** they are meant to be crossed - jump, wall-run or launch pad
- and `validate.js` proves each one against that route's reach at the speed the
runner will actually arrive with. Every limit is derived from `config.js`, so
retuning the jump re-validates all twelve levels rather than silently breaking
one.

## Racing

Opponents fill in exactly the same intent object the player's thumb does, and
are advanced by the same `stepRacer`. Nothing about an AI racer is privileged:
same gravity, same crates, same 60% speed loss for hitting one. Skill changes
only the quality and timing of decisions - reaction time, lane error, jump
timing, risk appetite, and how often it deliberately fumbles.

`sim/race/headless.js` runs a whole race with no renderer, which is what makes
difficulty tunable by measurement rather than by feel, and is how every level is
proved finishable in the test suite.

## Presentation

There are no asset files of any kind. Every sound is built from oscillators and
shaped noise in `audio/synth.js` and scheduled against the AudioContext clock -
scheduling rather than firing is what puts a footstep on the frame the foot
planted rather than wherever the frame happened to land. Three procedural music
beds cover four themes, each remapping timbre, tempo and key.

Animation is data: `data/anim/clips.js` holds Euler keyframe tracks with
blend-in times and embedded events, and `sim/anim/` samples and blends them
across three layers - a 1-D locomotion blend by speed, the parkour state's clip,
and additive lean. Because it is pure, "do crossfade weights stay sane" and
"does a footstep fire once per cycle at any rate" are ordinary assertions.

Every particle in the game lives in one `THREE.Points` over a preallocated pool,
so a new effect costs a table entry rather than a draw call.

## Progress

`SaveManager` takes a storage adapter rather than importing one, so it stays
inside the purity rule and can be tested against a full quota, corrupt JSON and
storage that throws on first access. Corrupt or unknown saves degrade to a fresh
profile rather than throwing; player level is derived from XP rather than
trusted, so a hand-edited file cannot grant it.

## Status

Playable end to end: twelve levels across four themes plus a practice track,
raced against a field of AI opponents, with vaulting, sliding, wall-running,
wall-jumping, mantling, launch pads, power-ups, coins and shards, checkpoints,
respawns, a countdown, live rank, pause, results, six unlockable runners,
settings, procedural audio and particles — and best times, medals, coins and XP
that survive a reload.

Still to come: a guided tutorial rather than the control list on the menu,
adaptive quality downgrade under sustained frame pressure, and a tuning pass
that sets per-level target times from measured reference runs rather than from
the player's own previous best.

## Not included, rather than faked

No online leaderboards or multiplayer. No GLTF or texture pipeline — all
geometry, animation and UI are procedural and original. No IAP or ads.
