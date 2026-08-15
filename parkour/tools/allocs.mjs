/**
 * Does the simulation actually allocate nothing per substep?
 *
 * The README claimed allocation-free hot paths. That is the sort of claim that
 * is true when written and quietly stops being true three features later, so
 * this measures it instead of trusting it.
 *
 *   node --expose-gc --max-semi-space-size=4 tools/allocs.mjs
 *
 * ## Why it is measured this way
 *
 * Two obvious approaches both fail, and it is worth writing down why so nobody
 * reaches for them again:
 *
 * - **Watching `process.memoryUsage().heapUsed` climb.** The reading only means
 *   "allocated" between collections, the collector fires constantly, and
 *   `memoryUsage()` itself allocates about 260 B per call. Measured this way the
 *   sim appeared to allocate 3.4 KB a substep - an answer dominated by the
 *   instrument.
 * - **`--heap-prof`.** V8's sampling heap profiler misses transient
 *   young-generation allocation almost entirely. Calibrated against a loop
 *   allocating a known 30 MiB of short-lived objects, it reported 0.0% of it.
 *
 * What does work is counting **scavenges**. A minor GC happens when new space
 * fills, so scavenges are directly proportional to bytes allocated, and the
 * constant is measured here at runtime rather than assumed: a calibration loop
 * allocates a known number of known-sized objects and the resulting scavenge
 * count gives bytes-per-scavenge on this machine, this Node, this heap size. A
 * non-allocating control loop then confirms the method reports zero when there
 * is genuinely nothing to report.
 *
 * Retention is measured separately, because it fails differently: a sim can
 * hold retained memory perfectly flat while producing garbage furiously. Growth
 * in retained heap is a leak; a high allocation rate is frame-time spikes on a
 * phone. Both matter, neither implies the other.
 */
import { PerformanceObserver, constants } from 'node:perf_hooks';
import { RACE } from '../src/config.js';
import { levelDef } from '../src/data/levels/index.js';
import { assembleLevel } from '../src/sim/level/assemble.js';
import { World } from '../src/sim/world/World.js';
import { EventQueue } from '../src/sim/core/events.js';
import { RaceManager, PHASE } from '../src/sim/race/RaceManager.js';
import { makeRacer, makeIntent } from '../src/sim/player/PlayerController.js';
import { autoPlayer } from '../src/sim/race/headless.js';

if (typeof globalThis.gc !== 'function') {
  console.error('\nRun with --expose-gc:\n'
    + '  node --expose-gc --max-semi-space-size=4 tools/allocs.mjs\n');
  process.exit(2);
}

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const ticks = Math.max(20000, Number(flag('ticks', 200000)));
const def = levelDef(flag('level', 'level-12'));

let scavenges = 0;
new PerformanceObserver((list) => {
  for (const e of list.getEntries()) {
    if (e.detail.kind === constants.NODE_PERFORMANCE_GC_MINOR) scavenges++;
  }
}).observe({ entryTypes: ['gc'] });

/** Lets the observer's queued entries land before they are read. */
const settleObserver = () => new Promise((r) => setTimeout(r, 40));

async function countScavenges(body, iterations) {
  for (let i = 0; i < Math.min(20000, iterations); i++) body(i);
  await settleObserver();
  scavenges = 0;
  for (let i = 0; i < iterations; i++) body(i);
  await settleObserver();
  return scavenges;
}

// --- Calibration -------------------------------------------------------------
// A plain object with three Smi fields is four words on a 64-bit heap: map,
// properties, elements, and the three in-object slots rounded up.
const OBJECT_BYTES = 32;
const CALIBRATION_ITERATIONS = 1000000;
let sink = null;
const calibrationScavenges = await countScavenges(() => {
  sink = { x: 1, y: 2, z: 3 };
}, CALIBRATION_ITERATIONS);
const controlScavenges = await countScavenges(() => { sink = null; }, CALIBRATION_ITERATIONS);

if (calibrationScavenges === 0) {
  console.error('\nCalibration allocated 30 MiB and saw no scavenge - new space is\n'
    + 'too large to measure against. Re-run with --max-semi-space-size=4.\n');
  process.exit(2);
}
const bytesPerScavenge = (CALIBRATION_ITERATIONS * OBJECT_BYTES) / calibrationScavenges;

console.log(`\nAllocation audit - ${def.id} "${def.name}", `
  + `${ticks.toLocaleString()} substeps\n`);
console.log('Calibration');
console.log(`  known load   ${(CALIBRATION_ITERATIONS * OBJECT_BYTES / 1048576).toFixed(1)} MiB `
  + `=> ${calibrationScavenges} scavenges (${(bytesPerScavenge / 1024).toFixed(0)} KiB each)`);
console.log(`  control      ${controlScavenges} scavenges for an allocation-free loop`
  + `${controlScavenges === 0 ? ' - the method reads zero as zero' : ' - NOISY'}\n`);

// --- The subject -------------------------------------------------------------
const level = assembleLevel(def);
let world = new World(level);
let player = makeRacer(0, { isPlayer: true, name: 'Player' });
let race = new RaceManager(world, player, def.roster, { seed: 101 });
const ev = new EventQueue(1024);
const intent = makeIntent();
let restarts = 0;

/**
 * One substep of a race that never ends.
 *
 * Restarted on finish rather than left parked at a DNF: a finished runner
 * exercises neither the affordance probes nor the AI nor the broadphase, and
 * measuring that would flatter the result considerably.
 */
function step() {
  if (race.phase === PHASE.FINISHED || race.tick > RACE.maxTicks) {
    world = new World(level);
    player = makeRacer(0, { isPlayer: true, name: 'Player' });
    race = new RaceManager(world, player, def.roster, { seed: 101 });
    restarts++;
  }
  autoPlayer(intent, player, world);
  race.step(intent, ev);
  ev.drain(() => {});
}

// --- 1. Retention ------------------------------------------------------------
const settle = () => {
  for (let i = 0; i < 4; i++) globalThis.gc();
  return process.memoryUsage().heapUsed;
};
for (let i = 0; i < 20000; i++) step();
const before = settle();
for (let i = 0; i < ticks; i++) step();
const after = settle();
const retainedPerTick = (after - before) / ticks;

console.log('Retention (settled heap either side of the run)');
console.log(`  ${(before / 1024).toFixed(0)} KiB -> ${(after / 1024).toFixed(0)} KiB`
  + `  =  ${retainedPerTick >= 0 ? '+' : ''}${retainedPerTick.toFixed(2)} B/substep`
  + `  (${restarts} races)\n`);

// --- 2. Allocation rate ------------------------------------------------------
const simScavenges = await countScavenges(step, ticks);
const bytesPerTick = (simScavenges * bytesPerScavenge) / ticks;
const fieldSize = race.racers.length;

console.log('Allocation rate');
console.log(`  ${simScavenges} scavenges over ${ticks.toLocaleString()} substeps`);
console.log(`  ${bytesPerTick.toFixed(0)} B/substep with a field of ${fieldSize}`
  + `  (${(bytesPerTick / fieldSize).toFixed(0)} B per racer)`);
console.log(`  ${(bytesPerTick * 60 / 1024).toFixed(1)} KiB/s at 60 Hz\n`);

// --- Verdict -----------------------------------------------------------------
// Retention is the hard limit: anything consistently above a byte or so a
// substep is something genuinely being kept, and a mobile session is long.
//
// The rate is a budget rather than a law. It currently measures around 450
// B/substep with a field of six, which is a scavenge roughly every twenty
// seconds of racing - far below anything a collector makes a frame out of. The
// bar is set at 600 to catch a regression without failing on noise; see the
// README for what the residue is and why it is not chased further.
const RATE_BUDGET = 600;
const problems = [];
if (retainedPerTick > 2) {
  problems.push(`retains ${retainedPerTick.toFixed(1)} B/substep - something is being kept`);
}
if (bytesPerTick > RATE_BUDGET) {
  problems.push(`allocates ${bytesPerTick.toFixed(0)} B/substep - `
    + `above the ${RATE_BUDGET} B budget`);
}

if (problems.length === 0) {
  console.log('Within budget: no retention, and the rate is far below a frame-time risk.\n');
} else {
  for (const p of problems) console.error(`  PROBLEM  ${p}`);
  console.error('');
  process.exit(1);
}
