# Choosing the palette

Four complete palettes were built and rendered against the real board — same
markup, same data, only the CSS custom properties swapped — then compared side
by side. Screenshots were taken of the hero and of the board at the point where
the permanent Top 5 meets the Top 10 tier, because that is where the colour
system has to do the most work at once: a premium tier, a highlighted row, two
timed tiers, an availability state and a price, all in one screen.

Every candidate was first tuned until it cleared WCAG AA at the size each pair
is actually used — including each tier's own label colour on its own soft tint,
which is the pairing that usually fails and the one nobody checks.

## The candidates

### A — Bazaar (chosen)
Warm cream ground, coral for anything you click or pay, amber for the permanent
Top 5, and a cool blue → teal → slate ladder for the timed tiers.

The hue split is by *meaning*, not by decoration: warm is money and status, cool
is the tier ladder, green is "live / available". Nothing warm is ever a tier and
nothing cool is ever a button, so the page sorts itself before you read a word
of it. Coral also has the strongest click affordance of the four accents while
staying short of alarm-red.

### B — Ledger
Ivory ground, navy ink, royal-blue button, amber premium.

The most institutionally trustworthy of the four, and the easiest to defend in
the abstract. It loses on a specific conflict: the blue call-to-action and the
blue Top 10 badge are the same hue, so blue stops meaning any one thing. Fixing
that means giving the tier ladder a hue it doesn't want, and the palette
unravels. It is also the most generic — this reads like every fintech dashboard.

### C — Souk
Sand ground, deep teal button, amber premium, terracotta Top 10.

Handsome and calmer than A. Two problems. Teal reads "eco / health / wellness"
rather than "buy", which is the wrong instinct on a button that charges $4,500.
And with terracotta on the tier badges, warm now means *both* money and tier,
which collides with the gold on the highlighted permanent row.

### D — Sunrise
Blush-peach ground, terracotta button, plum ink, magenta Top 20.

The most distinctive and the prettiest of the four, and the most fun to look at.
It is also the least appropriate: a blush ground with plum text reads cosmetic
and lifestyle, not a public ranking board people spend real money on. The plum
tier colour is a third warm-ish hue that the system does not have a job for.

## Why A won

It is the only one of the four where the colour code survives contact with the
busiest screen. B breaks it on a hue collision, C blurs the warm/cool split, and
D adds a hue with no job. A also keeps the reference brief the site was working
towards — warm, light, approachable, no monochrome — while holding the accent to
one confident colour rather than scattering it.

Two changes came out of the comparison and are now in `globals.css`:

- The timed tiers moved off coral onto the cool ladder. In the original palette
  the Top 10 badge and the buy button were both coral, which is exactly the
  collision that disqualified B.
- Every failing pair was tuned to AA. The old coral button fill in particular
  was only 3.31:1 against its own white label; it is 4.5:1 now.

The dark theme is a warm dark rather than a neutral one, on the same hue
assignments, so the code means the same thing in both.

## A second opinion, and what it changed

A separate exploration ran four palettes generated and judged independently of
the comparison above. Its winner was "Sand & Emerald" — a sand ground with a
deep bottle-green CTA, bronze for the permanent tier and pine-teal for the mid
tier. It is a good palette and close to candidate C here.

It was not adopted, for a reason the board makes obvious and abstract judging
does not: its accent (`#0A6647`) and its Top 10 tier colour (`#0B6B4C`) are the
same green. That is precisely the collision that disqualified candidate B, where
the button and the Top 10 badge were both blue — once the CTA hue and a tier hue
are the same, the colour stops meaning any one thing. Every palette here was
judged by rendering it on the screen where permanent, highlighted, timed and
available states appear at once, which is where that flaw shows up.

Two of its arguments were right, though, and are now implemented:

**Tier strength as a redundant channel.** It argued the tier tints should descend
monotonically in strength as well as change hue, so the ladder survives
colour-blindness and bad monitors. The palette here originally used a flat ~10%
tint for every tier and coded rank by hue alone. Tints are now tuned per hue —
per hue, because equal alpha does not read as equal strength across hues — so
measured tint-vs-surface contrast descends: 1.266 → 1.193 → 1.136 → 1.080 in
light, 1.349 → 1.264 → 1.162 → 1.089 in dark, with free rows untinted.

**Control boundaries are not decorative borders.** Its contrast notes drew the
distinction between hairlines and anything that identifies a control, which WCAG
1.4.11 requires to reach 3:1. That surfaced a real defect: every text input set
`outline-none` and signalled focus by swapping `--border` (1.21:1) for
`--border-strong` (1.50:1). Keyboard focus was effectively invisible across the
whole app. There is now a 2px `--accent` focus ring on `:focus-visible`
throughout, a `forced-colors` fallback, and a dedicated `--control-border` at
3:1 used on inputs only.

One of its recommendations was declined. It argued prices should always be set
in the foreground colour, because "pricing in green reads as a sales pitch,
pricing in near-black reads as a fact". That is right, and the price table and
board rows already follow it. The single exception is the hero's headline price,
which stays in the accent: there is exactly one of it, it is the offer itself,
and the emphasis is doing real work rather than decorating a number.
