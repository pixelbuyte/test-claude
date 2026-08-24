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
