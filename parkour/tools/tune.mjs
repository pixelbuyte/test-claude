/**
 * Measures a reference time for every level.
 *
 * Medal targets used to be derived from the player's own previous best, which
 * is a placeholder dressed up as a feature: it means a slow first lap sets a
 * slow gold, a fast one sets an unbeatable gold, and no two players are ever
 * chasing the same number. A target time is content, and content is measured.
 *
 * The measurement is the headless race runner - the same simulation, the same
 * fixed 60 Hz, the same `autoPlayer` driver that reacts to affordances the way
 * an opponent does. Because `src/sim` is pure, that run is deterministic: the
 * numbers this prints are the numbers any machine prints.
 *
 * What varies between runs is the race seed, which decides the opponent field's
 * jitter - and therefore who reaches a pickup first, and who is in the way at a
 * choke point. Racing each level several times over different seeds is what
 * separates "this course takes 48 s" from "this course takes 48 s when nothing
 * gets in the way".
 *
 *   node tools/tune.mjs                  # every level, 5 seeds each
 *   node tools/tune.mjs --runs 9
 *   node tools/tune.mjs --levels level-01,level-07
 *   node tools/tune.mjs --json
 */
import { LEVELS } from '../src/data/levels/index.js';
import { assembleLevel } from '../src/sim/level/assemble.js';
import { buildPracticeLevel } from '../src/data/levels/practice.js';
import { measureTime } from '../src/sim/race/headless.js';
import { targetsFor } from '../src/sim/save/SaveManager.js';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const runs = Math.max(1, Number(flag('runs', 5)));
const asJson = args.includes('--json');
const only = flag('levels', null);
const onlySet = only ? new Set(only.split(',').map((s) => s.trim())) : null;

/**
 * The practice track is measured too. It is not in `LEVELS` and gets no
 * authored targets - nobody should be chasing a medal on the tutorial course -
 * but it is the track movement tuning is judged against, so a regression in it
 * is worth seeing next to the others.
 */
const COURSES = [
  { id: 'practice', name: 'Practice', build: buildPracticeLevel, roster: [], authored: false },
  ...LEVELS.map((def) => ({
    id: def.id,
    name: def.name,
    build: () => assembleLevel(def),
    roster: def.roster,
    authored: true,
  })),
];

function median(sorted) {
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const rows = [];
for (const course of COURSES) {
  if (onlySet && !onlySet.has(course.id)) continue;

  // Built once and raced repeatedly: assembly is deterministic from the level's
  // own fixed seed, so rebuilding per run would burn seconds proving that.
  const level = course.build();
  const times = [];
  let dnf = 0;

  for (let i = 0; i < runs; i++) {
    // Seeds spread rather than sequential, so two adjacent runs are not two
    // near-identical opponent fields.
    const seed = 101 + i * 37;
    const t = measureTime(level, { roster: course.roster, seed });
    if (t === null) dnf++;
    else times.push(t);
  }

  if (times.length === 0) {
    rows.push({ ...course, dnf, reference: null });
    continue;
  }

  times.sort((a, b) => a - b);
  // The median, not the best: a reference time should describe a run that
  // usually happens, not the one where every pickup happened to land right.
  const reference = median(times);
  rows.push({
    id: course.id,
    name: course.name,
    authored: course.authored,
    runs: times.length,
    dnf,
    min: times[0],
    median: reference,
    max: times[times.length - 1],
    spread: times[times.length - 1] - times[0],
    targets: round3(targetsFor(reference)),
  });
}

function round3(t) {
  return {
    gold: Math.round(t.gold * 10) / 10,
    silver: Math.round(t.silver * 10) / 10,
    bronze: Math.round(t.bronze * 10) / 10,
  };
}

if (asJson) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  console.log(`\nReference times over ${runs} seeds per level `
    + '(headless, autoPlayer driver, fixed 60 Hz)\n');
  const head = ['level', 'name', 'min', 'median', 'max', 'spread', 'DNF', 'gold', 'silver', 'bronze'];
  const widths = [10, 12, 7, 7, 7, 7, 4, 7, 7, 7];
  const line = (cells) => cells.map((c, i) => String(c).padEnd(widths[i])).join(' ');
  console.log(line(head));
  console.log(widths.map((w) => '-'.repeat(w)).join(' '));

  for (const r of rows) {
    if (r.reference === null) {
      console.log(line([r.id, r.name, '-', '-', '-', '-', r.dnf, '-', '-', '-']));
      continue;
    }
    console.log(line([
      r.id, r.name,
      r.min.toFixed(2), r.median.toFixed(2), r.max.toFixed(2), r.spread.toFixed(2),
      r.dnf, r.targets.gold, r.targets.silver, r.targets.bronze,
    ]));
  }

  console.log('\nPaste-ready targets for src/data/levels/index.js:\n');
  for (const r of rows) {
    if (!r.authored || r.reference === null) continue;
    console.log(`    // ${r.name}: measured ${r.median.toFixed(2)}s `
      + `(${r.min.toFixed(2)}-${r.max.toFixed(2)} over ${r.runs} seeds)`);
    console.log(`    targets: { gold: ${r.targets.gold}, `
      + `silver: ${r.targets.silver}, bronze: ${r.targets.bronze} },`);
  }
  console.log();
}

const unfinishable = rows.filter((r) => r.reference === null);
if (unfinishable.length) {
  console.error(`\n${unfinishable.length} level(s) never finished: `
    + `${unfinishable.map((r) => r.id).join(', ')}\n`);
  process.exit(1);
}
