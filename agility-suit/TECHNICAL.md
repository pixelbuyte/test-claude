# Telltale — technical breakdown

Companion to the design canvas (sheets 05–06 cover this visually). This is the same
material in prose, with more room for caveats than fits on a concept sheet.

## The honest framing, in more depth

The pitch has to survive someone asking "so does it make me faster?" The answer is no,
and the reason is worth having ready:

- A **spinal reflex arc** (say, snatching your hand off something hot) runs through the
  spinal cord without waiting for the brain, on the order of tens of milliseconds. This
  suit has no path to the muscles — it can't intercept or shortcut that loop, and
  shouldn't claim to.
- What it *can* do is get **information** to the wearer earlier than their own senses
  would. Simple visual reaction time to an *expected* stimulus is commonly cited around
  180–220 ms; reaction to something genuinely unexpected runs closer to 300–400 ms once
  you count the "wait, what was that" recognition delay. These are well-established
  ballpark figures from reaction-time research, not measurements of this suit — treat
  them as the right order of magnitude, not a spec.
- If the suit's own sense → decide → actuate loop lands in the 30–50 ms range (see
  below), a haptic pulse arrives roughly **150–350 ms before** the wearer would
  otherwise have consciously clocked the hazard. That's a real, useful head start for
  something like an off-balance landing or an obstacle entering peripheral vision — and
  it's an honest claim. "Turns a surprise into something half-expected" is accurate;
  "superhuman reflexes" is not.

## Signal path (5 stages)

1. **Environment** — the raw event: an incoming impact, a proximity closing fast, a
   loss of balance.
2. **Sensors** (~5 ms to sample) — an IMU for orientation/acceleration, plus a
   proximity or impact-anticipation sensor (see tiers below for what's realistic at
   each budget).
3. **Core hub** (~10 ms to decide) — sensor fusion and arbitration: given what just
   happened, which of the four output nodes (if any) should fire, and how hard.
4. **Signal bus** (~2–15 ms to relay) — getting the "fire" command from the hub to the
   node. Wired is lower-latency and more deterministic than wireless; see the
   connectivity note below.
5. **Cue node** (~5–100 ms to actuate, tier-dependent) — the haptic actuator itself
   physically moving. This stage dominates the budget, and the actuator choice
   (ERM vs. LRA) is the single biggest lever on whether the suit feels responsive or
   laggy.

Total estimated loop: **~30–50 ms** with a good actuator (LRA), **~80–150 ms** with a
cheap one (ERM) — worth stating plainly, because it's the difference between "feels
alive" and "feels like a buzzer went off after the fact."

## Subsystems

### Sensing
- **Core IMU**: accelerometer + gyroscope (+ ideally magnetometer) for orientation and
  sudden-motion detection. This is the one sensor every tier needs.
- **Proximity / impact anticipation**: harder problem than it sounds — a single body-worn
  sensor can't see everything coming. A compact mmWave/Doppler radar module or ToF
  sensor at the core hub gives forward-facing proximity sensing; it will not cover
  omnidirectional threats without more sensors than is practical for a first build. Be
  upfront about this limitation rather than implying 360° awareness.
- **Environmental scan (visor)**: cosmetic/aspirational in the near term. A real
  forward-facing camera or LIDAR small enough to sit in a mask visor and cheap enough
  for this budget doesn't really exist yet at consumer scale — treat the visor as a
  design element and a *future* sensor location, not a committed feature.

### Haptics (×4 — both palms, both soles)
- **ERM (eccentric rotating mass) motors**: cheap, simple, the coin-cell vibration
  motors in every budget gadget. Rise time is slow — on the order of 50–100 ms to reach
  a noticeable amplitude — because a physical mass has to spin up. This alone can eat
  most of a "pulse before contact" latency budget.
- **LRA (linear resonant actuators)**: a magnet driven back and forth on a spring at its
  resonant frequency. Much faster rise time (roughly 5–15 ms) and cleaner start/stop,
  which is why they're standard in phone haptics now. Needs a proper driver IC (e.g. a
  DRV2605-class haptic driver) to get waveform control, not just an on/off transistor.
- This is the clearest "you get what you pay for" line item in the whole build — it's
  worth spending the upgrade budget here before anywhere else.

### Power
- DIY: a single small LiPo cell (~500 mAh) with a basic single-cell charge IC. Fine for
  bench testing, not for a full day of wear.
- Advanced: a larger cell (~2000 mAh), USB-C charging, roughly 4–8 hours of realistic
  runtime depending on how often nodes fire.
- Near-production: weight distribution starts to matter for comfort — multiple smaller
  cells placed around the suit instead of one lump at the waist, ideally hot-swappable,
  with a wireless charging dock for end-of-day top-up.

### Connectivity / signal bus
Wireless (BLE) is the obvious instinct but has a real cost here: connection-interval
jitter can add tens of milliseconds of unpredictable delay, which is exactly what this
system is trying to minimize. **A thin wired harness is the safer default** for a
build where timing is the entire point — reserve wireless for a companion app or
telemetry link, not the safety-relevant signal path.

### Materials / shell
- The kite emblems are a physical stack, roughly: a translucent diffuser lens on top,
  an RGB+white LED array (or a single tuned-color LED for a fixed colorway) beneath
  that, a small flex-PCB carrying the LED and driver traces, and the haptic actuator
  itself mounted directly behind for palm/sole nodes.
- DIY: 3D-printed housings, an addressable LED strip (WS2812-style) standing in for a
  proper diffused glow.
- Advanced: real flex-PCB + diffuser lens + a silicone-overmolded housing — this is
  where the glow actually starts looking like the concept art instead of a bare LED.
- Near-production: medical-grade silicone, laser-welded seams instead of stitching
  (stitching is a failure point under repeated flexing), IP54+ splash/dust rating.
- **Base garment**: starts as sewing electronics onto an off-the-shelf compression
  layer, moves to a purpose-cut 4-way-stretch laminate, and only gets to a body-scanned
  custom garment at the near-production tier — this is a real cost driver, not an
  afterthought.

## Build tiers — summary

| | DIY / Maker | Advanced Prototype | Near-Production |
|---|---|---|---|
| Core | ESP32 + BNO055 | nRF52840 + BNO086 + compact mmWave module | Redundant IMUs, integrated mmWave/ToF, dedicated fusion coprocessor |
| Haptics | ERM, ~60–100 ms rise | LRA + DRV2605L driver, ~5–15 ms rise | Closed-loop LRA, auto-tuned per contact |
| Signal path | Wired I²C, breadboard | Thin wired harness (BLE as fallback) | Low-latency wired backbone; wireless for telemetry only |
| Power | 500 mAh LiPo | 2000 mAh LiPo, USB-C, 4–8 h | Distributed cells, hot-swap, wireless dock |
| Shell | 3D-printed + LED strip | Flex-PCB + diffuser + silicone overmold | Medical-grade silicone, laser-welded |
| Base layer | Sewn onto off-the-shelf layer | Laminated 4-way-stretch, purpose-cut | Body-scanned, IP54+ |
| **Parts cost** | **$150–350** | **$1,200–3,000** | **$8,000–25,000 / unit** |
| **Build time** | A weekend–2 weeks | 1–3 months | 6–12 months |

None of these numbers are quotes — they're reasoned estimates from typical component
pricing at the time of writing, for a solo/small-team build, not a manufacturing
partner's BOM. Get real quotes before committing money.

## Recommended next step

Build the **Advanced Prototype** tier's haptic loop in isolation first — core hub +
one LRA node, wired, nothing else — and actually measure the sense-to-cue latency
before building the rest of the suit around it. Everything above is an estimate; that
one measurement either confirms the whole "head start" pitch or tells you early that
the numbers need revising.
