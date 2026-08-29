# VitalPulse — Product Design Doc

A pulse, heart-rhythm, and blood-pressure *tracking* app, built honestly.

## 1. Why not "check blood pressure with a fingerprint"?

We researched this exact category before writing any code, because the standard
pitch — "put your finger on the sensor, get your blood pressure" — turns out to
be the single biggest reason this app category has a bad reputation.

**What the research found:**

- Cuffless finger/camera "blood pressure" apps measured systolic pressure **20–25
  points off** and diastolic **10–15 points off** vs. a real cuff in independent
  comparisons, and in one widely-cited study **~80% of users with clinically high
  blood pressure were shown a "normal" reading.** ([tctmd.com](https://www.tctmd.com/news/wildly-popular-dangerously-inaccurate-blood-pressure-monitoring-app-misses-mark), [ScienceDaily](https://www.sciencedaily.com/releases/2016/03/160302135622.htm))
- Medical/fact-check reviewers are blunt about it: *"Only certified medical
  devices should be used to measure blood pressure, not unvalidated apps."*
  ([Science Feedback](https://science.feedback.org/review/only-certified-medical-devices-should-be-used-to-measure-blood-pressure-not-unvalidated-apps-promoted-social-media/))
- As of the most recent reporting, **no phone camera or fingerprint sensor can
  derive an actual blood pressure reading** — the physics aren't there yet. Every
  legitimate app requires an external cuff. ([medm.com](https://www.medm.com/company/blog/2024/how-accurate-are-finger-blood-pressure-apps.html))
- The apps that *do* claim finger-only BP get called out in reviews for "duping
  users into paying for undeliverable" results.

**What people actually complain about in this whole app category** (heart-rate
and BP apps alike), pulled from App Store / Play Store review analysis:

| Complaint | Source |
|---|---|
| 4 ads in a row, 5–10s each, after every single reading | justuseapp.com review analysis |
| Full-screen ads with tiny, low-contrast "continue" buttons | same |
| Popups that gate app use behind leaving a 5-star review | same |
| Data entered for weeks, then locked behind a paywall to view trends | Play Store reviews |
| Wildly fluctuating readings the user has no reason to trust | multiple |
| No explanation of *how* the number was produced | multiple |
| 79% of health apps studied have no data-breach protocol; only 25% state HIPAA compliance, 18% GDPR | [arXiv:2410.14607](https://arxiv.org/abs/2410.14607) |
| Older adults specifically worry about *who else* can see their health data | [NCBI](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9237761/) |

**What people *like*:** big readable numbers, a trend graph they can screenshot
for their doctor, a reminder to check in, and — repeatedly — *not being nagged*.

### Design decisions this drives directly
1. **Never claim to measure blood pressure from a sensor.** Full stop. BP is
   always a manual entry from the user's own cuff. The app is honest about this
   in the very first screen, not buried in a ToS.
2. **Camera-based Pulse Check is real and disclosed**: front camera + flash,
   photoplethysmography (PPG) on the fingertip, gives heart rate and basic
   rhythm-variability (HRV) — the thing a phone *can* actually do — labeled
   "wellness estimate, not a medical device" every time it's shown.
3. **No ads, no forced ratings, no paywalled trend data.** Everything you log is
   yours to see, always.
4. **All data stored on-device only.** No account, no server, no sharing —
   removes the #1 privacy fear from the research above.
5. **Elder-first accessibility as a default, not a settings toggle nobody finds.**

## 2. Product

**Name:** VitalPulse
**One-liner:** *"Know your numbers. Track them honestly."*

**Core features (MVP):**
- **Pulse Check** — 30-second camera-based heart rate + HRV reading, with a
  live "hold still" guide and large, unmistakable countdown.
- **Blood Pressure Log** — quick manual entry (systolic/diastolic/pulse) from
  the user's own cuff; big number-pad, no typing required.
- **Trends** — one combined, readable chart per metric, plus a 7/30/90-day
  average. Exportable as a plain PDF/CSV to hand to or email a doctor.
- **Reminders** — optional, gentle, local notifications ("time for your
  morning reading") — no engagement-farming push spam.
- **How This Works** — a permanent, one-tap page in plain language explaining
  exactly what the app can and can't measure.
- **Settings** — text size (4 steps, up to extra-large), high-contrast theme,
  left/right-hand mode for the camera check, data export/delete-everything.

**Explicitly not building:** login/accounts, ads, in-app purchases, social
features, cloud sync, "AI health insights" that oversell what the data can
support.

## 3. Accessibility commitments (any age, genuinely)

- Minimum 17pt body text, 24pt+ for key numbers, scalable to 200%.
- Minimum 44×44pt tap targets everywhere (WCAG 2.1 AA), spaced to avoid
  mis-taps.
- High-contrast theme (not just dark mode) meeting 7:1 contrast.
- One primary action per screen; no nested menus for core tasks.
- Full screen-reader labeling (VoiceOver / TalkBack) on every control.
- No reliance on color alone to convey meaning (icons + text labels).
- No time-limited interactions except the unavoidable 30s pulse scan, which
  can be paused/redone with one tap.

## 4. Visual direction

- **Palette:** warm paper background (`#F4F1E8`), deep teal (`#0B5D5A`) primary,
  coral (`#E8734A`) reserved for the one action per screen, a small gold accent
  for calm informational notes, and a dedicated danger red kept only for
  destructive actions — never used to editorialize a health reading.
- **Type, a three-tier system:**
  - *National Park* (bold) — the wordmark and every screen title. Warm and
    rounded rather than clinical, with enough character to be memorable
    without tipping into novelty.
  - *Instrument Sans* — all body copy, labels, and button text. Chosen over
    Inter/Roboto/system defaults for better warmth and legibility at the
    larger sizes this app defaults to.
  - *Outfit* (bold) — reserved for the numbers that matter: BPM, BP readings,
    the pulse-check countdown, keypad digits. Tabular figures keep columns of
    readings aligned in Trends.
- **Iconography:** a small hand-drawn line-icon set (heart pulse, gauge, home,
  trend, book, lock, etc.) replaces emoji everywhere. Emoji render
  inconsistently across OS/keyboard versions and read as decoration; these
  read as an intentional part of the interface and stay legible at any text
  scale.
- **Depth & atmosphere:** soft color-tinted shadows (teal-tinted glow behind
  the pulse ring, coral-tinted lift under the primary button) instead of flat
  cards, so the app has some dimensionality without ever feeling busy.
- **Layout:** single-column, generous whitespace, one idea per screen.

## 4a. Information design: making the numbers mean something

The visual layer above is only half the job. A tracking app's real design
problem is whether a reading *communicates* — and two decisions here matter
more than any styling choice:

**Charts use a fixed clinical scale, never auto-scaled to the data.**
Auto-scaling to a series' own min/max is the default in most charting
libraries and it is quietly dishonest on a health chart: a systolic drifting
118 → 121 and one spiking 118 → 180 render as the *identical* shape. VitalPulse
pins the y-axis to a fixed clinical domain (50–190 mmHg for BP, 40–130 bpm for
pulse) so the steepness of a line always means the same thing, and pairs it
with gridlines, axis labels, dated endpoints, and a shaded reference band for
the normal range.

**Every reading carries its category.** Without it, 118/76 and 155/98 render
identically — while the app's own onboarding promises to help you "spot what's
worth a call to your doctor." Readings are mapped to the American Heart
Association's published category ranges (`src/health/bpCategory.ts`) and shown
as a labeled pill, using a semantic status ramp kept deliberately separate
from the teal/coral brand accent — brand colors say "this is VitalPulse,"
status colors say "here is where your number falls."

Three guardrails keep this honest rather than diagnostic:
1. The AHA thresholds are public reference ranges, and the app says so every
   time it shows one: *"a description of where your numbers fall, not a
   diagnosis. Your doctor sets what's right for you."*
2. Categories are described, never prescribed — the copy states what a range
   *is*, and never tells anyone what to do about it (the sole exception is the
   crisis band, where "contact a doctor" is the only responsible line).
3. Color is never the only signal: every pill carries a text label, so it
   works for colorblind users and screen readers alike.

## 5. Tech approach ("lightweight, easy to download")

- **Expo + React Native + TypeScript**, single codebase → iOS + Android.
- No heavy UI kit; hand-built components on top of core RN primitives to keep
  bundle size down.
- On-device storage only (`expo-sqlite`), no backend, no auth SDKs, no ad
  SDKs, no analytics SDKs — this alone keeps the binary small and the
  cold-start fast, and removes most of the privacy risk surface above.
- Camera PPG runs entirely on-device; nothing leaves the phone.

## 6. Screen map
Onboarding (3 short screens: what this is → what it isn't → privacy) → Home
(today's pulse + last BP + one CTA) → Pulse Check → Log BP → Trends → How
This Works → Settings.

## Sources
- https://www.tctmd.com/news/wildly-popular-dangerously-inaccurate-blood-pressure-monitoring-app-misses-mark
- https://www.sciencedaily.com/releases/2016/03/160302135622.htm
- https://science.feedback.org/review/only-certified-medical-devices-should-be-used-to-measure-blood-pressure-not-unvalidated-apps-promoted-social-media/
- https://www.medm.com/company/blog/2024/how-accurate-are-finger-blood-pressure-apps.html
- https://justuseapp.com/en/app/409625068/instant-heart-rate-hr-monitor/reviews
- https://arxiv.org/abs/2410.14607
- https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9237761/
