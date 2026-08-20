# Telltale — decision log

**Name: Telltale** (locked 2026-08-19 — "it tells you before it happens"). Formerly
tracked under the working title "Project Instinct"; that name still appears in a few
older screenshots/exports but the canvas and this doc now use Telltale throughout.

This file is the running memory for this project across sessions. Update it whenever
a decision actually gets made — don't re-litigate a locked decision without a reason.

## Concept (locked)

A fitted bodysuit with five glowing kite-shaped sensor/haptic nodes: both palms, both
soles, and one larger core hub at the waist. The waist hub fuses IMU + proximity/impact
sensing and decides which node should fire; the palm/sole nodes are haptic outputs that
pulse a fraction of a second before predicted contact — a physical heads-up, not a
reflex replacement. Visual language: sleek anime/Avengers-style hero suit, not bulky
armor — closer to Iron Man's fitted undersuit or a JJK/Dragon Ball hero cut than a
mecha exosuit.

**Realistic framing (locked, load-bearing for every technical artifact):** this augments
awareness and decision-making. It does not make the wearer faster. The suit's own
sense-to-cue loop is estimated at ~30–50 ms; a spinal reflex arc is faster than that and
the suit has no path to the muscles anyway. What it *can* do is arrive well before the
wearer's own conscious reaction to a surprise (~180–400 ms depending on how unexpected
the hazard is) — a 150–350 ms head start. That gap is the entire value proposition and
should anchor every future pitch, not "superhuman reflexes."

## Visual identity (locked)

- **Format**: a vector "tech-pack" character/construction sheet (front + back + action
  pose + colorway comparison), not a painterly AI-generated hero render — no
  photorealistic image generator is connected in this environment, and the tech-pack
  format is actually the industry-standard way costume/suit designers document a build
  anyway. Prompts for a real image generator (Midjourney/Firefly/etc.), if wanted later,
  should be written separately — ask before generating those.
- **Head**: full-coverage sleek mask/helmet, no exposed skin, single glowing horizontal
  visor band (functional framing: doubles as an AR/environmental-scan display).
- **Torso**: chest chevron leads the eye down to the waist hub; shoulder caps, side trim,
  a spine seam + shoulder-blade panels + 3-line cooling vent on the back (functional:
  venting for the core hub's heat).
- **Emblem shape**: a kite (four points — tall top, short bottom, symmetric left/right),
  not a plain diamond. Rendered as a crisp filled kite over a soft blurred glow bloom.
- **Default colorway**: **Umbra** — graphite/near-black base (#14151a), cool slate trim
  (#2c3038), electric-cyan glow (#8fe8ff). Three alternates exist on the canvas:
  **Ember** (near-black + cursed-technique red-orange, JJK-coded), **Zenith** (pearl
  white + muted gold, "ascended"/DBZ-coded), **Nova** (deep violet, psychic/mystic).

## Locked this session

- [x] **Primary colorway: Umbra** (graphite + electric cyan). Ember/Zenith/Nova stay on
  the canvas as documented alternates, not candidates still in play.
- [x] **Name: Telltale.** Not yet trademark-checked — do that before using it anywhere
  public (packaging, a domain, a pitch deck cover).

## Open decisions

- [ ] **First build tier to actually target** — DIY/Maker (~$150–350, proves the
  concept but ERM motors alone add 50–100 ms, so the "pulse before contact" effect will
  feel laggy) vs. Advanced Prototype (~$1,200–3,000, LRA + real haptic driver is where
  it starts to feel real) vs. Near-Production (~$8,000–25,000/unit, not the next step).
- [ ] Whether to write real image-generator prompts (Midjourney/Firefly-style) for a
  painterly hero render, separate from the tech-pack sheets.
- [ ] Whether to turn this into an actual pptx pitch deck or keep it as the design
  canvas + this doc.

## Where things live

- **Design canvas** (visual concept — front/back sheets, colorways, action pose, signal
  diagram, build-tier table, naming): published as a Claude Design canvas artifact.
  Source files (editable, re-seed from these): `agility-suit/canvas/*.dc.html` +
  `canvas.json`. Prototypes used to validate the figure drawing before sealing them into
  the canvas format live in `agility-suit/proto/` (throwaway, not part of the deliverable).
- **Technical breakdown** (component choices, feasibility tiers, cost, latency budget —
  same content as the canvas's TechSpecs/SystemDiagram sheets, in prose form for
  reference/copy-paste): `agility-suit/TECHNICAL.md`.
- **This file**: `agility-suit/DECISIONS.md` — read this first when picking the project
  back up.

## Session log

- **2026-08-19** — Initial concept build. Established the 5-node layout, kite emblem
  construction, tech-pack visual format (no image generator available in this session),
  4 colorways, dynamic action pose, signal-path/latency diagram, build-tier table with
  real component picks, 5 naming candidates. Published as a Claude Design canvas.
- **2026-08-19** — Locked Umbra as primary colorway and Telltale as the name. Canvas
  and both docs updated to match.
