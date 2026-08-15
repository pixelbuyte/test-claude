/**
 * Headless browser smoke test.
 *
 * `npm test` proves the simulation is right; this proves the game actually
 * loads, gets a live WebGL context, and runs a real frame loop with no console
 * errors. Those are different failure modes - a broken import map or a typo in
 * a render file passes every unit test in the suite.
 *
 * Lives in tools/ rather than test/ so `node --test` does not try to launch a
 * browser as part of the unit run.
 *
 *   node tools/smoke.mjs [--headed] [--seconds 12]
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, extname, normalize } from 'node:path';
import { mkdirSync } from 'node:fs';

/**
 * Playwright is a tool dependency, not a project one - `npm test` must stay
 * dependency-free - so it may equally be installed locally or globally. Try both
 * rather than forcing an install into the project.
 */
async function loadChromium() {
  try {
    return (await import('playwright')).chromium;
  } catch { /* fall through to the global install */ }
  try {
    const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
    // index.mjs, not index.js: the CommonJS entry point does not surface named
    // exports to an ESM importer, so `chromium` would come back undefined.
    const url = pathToFileURL(join(globalRoot, 'playwright', 'index.mjs')).href;
    const mod = await import(url);
    return mod.chromium || mod.default?.chromium;
  } catch (e) {
    console.error('\nCould not load playwright. Install it with one of:\n'
      + '  npm i -D playwright\n  npm i -g playwright\n');
    throw e;
  }
}

const chromium = await loadChromium();

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const shots = join(root, 'tools', 'screenshots');

const args = process.argv.slice(2);
const headed = args.includes('--headed');
const seconds = Number(args[args.indexOf('--seconds') + 1]) || 12;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function serve(port) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
      const path = join(root, rel === '/' ? 'index.html' : rel);
      const body = await readFile(path);
      res.writeHead(200, {
        'Content-Type': MIME[extname(path)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

const problems = [];
function fail(msg) {
  problems.push(msg);
  console.error(`  FAIL  ${msg}`);
}
function pass(msg) {
  console.log(`  ok    ${msg}`);
}

const port = 8123;
const server = await serve(port);
mkdirSync(shots, { recursive: true });

// Audio needs the gesture policy relaxed, or the context stays suspended and
// there is nothing to assert about it.
const browser = await chromium.launch({
  headless: !headed,
  args: ['--autoplay-policy=no-user-gesture-required'],
});
// A phone-shaped portrait viewport, because that is the target device.
const context = await browser.newContext({
  viewport: { width: 412, height: 892 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
});
const page = await context.newPage();

const consoleErrors = [];
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text());
});
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

console.log(`\nVertigo Rush smoke test (${seconds}s run)\n`);

await page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__vertigo, null, { timeout: 15000 });
pass('page loaded and the game booted');

const gpu = await page.evaluate(() => {
  const c = document.getElementById('game');
  if (!(c.getContext('webgl2') || c.getContext('webgl'))) return null;
  const probe = document.createElement('canvas').getContext('webgl');
  const info = probe && probe.getExtension('WEBGL_debug_renderer_info');
  return info ? probe.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'unknown';
});
if (gpu) pass(`live WebGL context (${gpu.slice(0, 60)})`); else fail('no WebGL context');

// CI and this container rasterise in software, where frame rate measures the
// rasteriser rather than the game. Where that is the case, hold the CPU-side
// budget to account instead and report frame rate as information only.
const software = !gpu || /swiftshader|llvmpipe|software|mesa offscreen/i.test(gpu);

await page.screenshot({ path: join(shots, '01-menu.png') });

// --- Drive a run ------------------------------------------------------------
await page.evaluate(() => window.__vertigo.start());
await page.waitForTimeout(400);

const box = await page.locator('#game').boundingBox();
const cx = box.x + box.width / 2;
const cy = box.y + box.height * 0.6;

// Synthetic touch: steer, jump, slide - the same gestures a player would make.
const swipe = async (dx, dy) => {
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + dx, cy + dy, { steps: 6 });
  await page.mouse.up();
};

const deadline = Date.now() + seconds * 1000;
let gestures = 0;
let hintShot = false;
while (Date.now() < deadline) {
  const st = await page.evaluate(() => {
    const s = window.__vertigo.session;
    const toastEl = document.getElementById('toast');
    return {
      slide: s.player.affordances.slideNeeded,
      gap: s.player.affordances.gapDistance,
      grounded: s.player.grounded,
      wall: s.player.affordances.wallLeftValid,
      // A hint is on screen when the toast is showing something the tutorial
      // wrote rather than something an event wrote.
      hint: toastEl.classList.contains('show')
        && /swipe|steer|vault|launch/i.test(toastEl.textContent)
        ? toastEl.textContent.trim() : null,
    };
  });

  if (st.hint && !hintShot) {
    hintShot = true;
    await page.screenshot({ path: join(shots, '04-tutorial.png') });
    pass(`caught a tutorial hint on screen: "${st.hint}"`);
  }

  if (st.slide) await swipe(0, 70);
  else if (st.gap > 0 && st.gap < 3) await swipe(0, -70);
  else if (st.wall) await swipe(-90, -70);
  else await page.mouse.click(cx, cy);
  gestures++;
  await page.waitForTimeout(180);
}
pass(`drove ${gestures} synthetic gestures`);

await page.screenshot({ path: join(shots, '02-running.png') });

// --- Assert the run actually happened ---------------------------------------
const result = await page.evaluate(() => {
  const v = window.__vertigo;
  const s = v.session;
  const hud = s.hudState();
  return {
    z: s.player.pos.z,
    tick: s.tick,
    elapsed: s.elapsed,
    coins: s.player.coins,
    progress: hud.progress,
    rank: hud.rank,
    fieldSize: hud.fieldSize,
    // Every opponent should be somewhere sensible on the course, not at 0.
    opponentZ: s.race.racers.slice(1).map((r) => Math.round(r.pos.z)),
    opponentsFinite: s.race.racers.every((r) => Number.isFinite(r.pos.z)),
    fps: v.fps,
    draws: v.renderer.drawCalls,
    tris: v.renderer.triangles,
    finite: Number.isFinite(s.player.pos.x) && Number.isFinite(s.player.pos.y)
      && Number.isFinite(s.player.pos.z),
    hudTime: document.getElementById('hud-time').textContent,
    hudRank: document.getElementById('hud-rank').textContent,
    progressWidth: document.getElementById('hud-progress-fill').style.width,
  };
});

if (result.tick > 60 * (seconds - 2)) pass(`simulation ran ${result.tick} substeps`);
else fail(`simulation only ran ${result.tick} substeps in ${seconds}s`);

if (result.z > 40) pass(`runner reached z=${result.z.toFixed(1)} (${(result.progress * 100).toFixed(0)}% of course)`);
else fail(`runner barely moved: z=${result.z.toFixed(1)}`);

if (result.finite) pass('body position finite'); else fail('body position went NaN');

// --- Audio and VFX -----------------------------------------------------------
const av = await page.evaluate(() => {
  const v = window.__vertigo;
  const s = v.session;
  const before = s.vfx.alive;
  s.vfx.emit('crash', s.player.pos, { scale: 2 });
  return {
    audioStarted: v.audio.started,
    audioFailed: v.audio.failed,
    audioState: v.audio.ctx ? v.audio.ctx.state : 'none',
    music: !!v.audio.music,
    vfxBefore: before,
    vfxAfter: s.vfx.alive,
    vfxBudget: s.vfx.budget,
  };
});

if (av.audioStarted && av.audioState === 'running') {
  pass(`audio running${av.music ? ' with a music bed' : ''}`);
} else if (av.audioFailed) {
  fail('audio failed to start');
} else {
  console.log(`  info  audio context is "${av.audioState}" - browser policy, not a defect`);
}

if (av.vfxAfter > av.vfxBefore) {
  pass(`particles alive after an emit (${av.vfxAfter}/${av.vfxBudget})`);
} else {
  fail(`emitting produced no particles (${av.vfxBefore} -> ${av.vfxAfter})`);
}

if (result.hudTime !== '0:00.00') pass(`HUD clock advanced to ${result.hudTime}`);
else fail('HUD clock never moved');

if (result.opponentsFinite && result.opponentZ.some((z) => z > 20)) {
  pass(`${result.fieldSize - 1} opponents racing (z = ${result.opponentZ.join(', ')})`);
} else {
  fail(`opponents are not racing: z = ${result.opponentZ.join(', ')}`);
}

if (/^\d+\/\d+$/.test(result.hudRank)) pass(`HUD rank showing ${result.hudRank}`);
else fail(`HUD rank is "${result.hudRank}"`);

if (parseFloat(result.progressWidth) > 0) pass(`progress bar at ${result.progressWidth}`);
else fail('progress bar never filled');

// --- Frame budget ------------------------------------------------------------
// Measures the work the game itself does: one simulation step plus the draw-call
// submission for one frame. GPU rasterisation time is deliberately excluded -
// it is the one part of the frame this code does not control.
const budget = await page.evaluate(() => {
  const v = window.__vertigo;
  const s = v.session;
  let sim = 0;
  let submit = 0;
  const N = 90;
  for (let i = 0; i < N; i++) {
    let t = performance.now();
    s.update(1 / 60);
    sim += performance.now() - t;
    t = performance.now();
    s.render(1 / 60);
    submit += performance.now() - t;
  }
  return { sim: sim / N, submit: submit / N };
});

const cpuMs = budget.sim + budget.submit;
if (cpuMs < 4) {
  pass(`${cpuMs.toFixed(2)} ms CPU per frame (sim ${budget.sim.toFixed(2)} + submit ${budget.submit.toFixed(2)}), budget 4 ms`);
} else {
  fail(`${cpuMs.toFixed(2)} ms CPU per frame exceeds the 4 ms budget`);
}

if (software) {
  console.log(`  info  ${result.fps.toFixed(0)} fps under software rasterisation - fill-rate bound here, not indicative of device performance`);
} else if (result.fps >= 50) {
  pass(`${result.fps.toFixed(0)} fps`);
} else {
  fail(`only ${result.fps.toFixed(1)} fps on a hardware GPU`);
}

if (result.draws <= 120) pass(`${result.draws} draw calls (budget 120)`);
else fail(`${result.draws} draw calls exceeds the 120 budget`);

if (result.tris <= 60000) pass(`${(result.tris / 1000).toFixed(1)}k triangles (budget 60k)`);
else fail(`${result.tris} triangles exceeds the 60k budget`);

// --- Tutorial -----------------------------------------------------------------
// The director is unit-tested against synthetic affordances; what only a real
// race proves is that a real course actually produces those affordances, in a
// browser, with the toast wired up. A tutorial nobody is ever shown is the
// failure mode a unit test cannot see.
const tut = await page.evaluate(() => {
  const v = window.__vertigo;
  return {
    remaining: v.tutorial.remaining,
    seen: Object.keys(v.save.data.tutorialSeen),
    enabled: v.tutorial.enabled,
    persisted: Object.keys(JSON.parse(
      window.localStorage.getItem('vertigo-rush.save.v1') || '{}',
    ).tutorialSeen || {}),
  };
});

if (tut.seen.length > 0) {
  pass(`tutorial taught ${tut.seen.length} move(s) during the run `
    + `(${tut.seen.join(', ')}; ${tut.remaining.length} left)`);
} else {
  fail('no tutorial hint fired in a whole race');
}
if (tut.persisted.length === tut.seen.length) {
  pass(`hints persisted to storage (${tut.persisted.join(', ')})`);
} else {
  fail(`hints shown but not persisted: ${tut.seen} vs saved ${tut.persisted}`);
}

// --- Adaptive quality ---------------------------------------------------------
// The governor's arithmetic is unit-tested; what only a browser can prove is
// that carrying out its verdict on a live renderer - swapping pixel ratio and
// recompiling every material for the shadow change - does not throw or blank the
// scene. Frame times are fed in directly rather than waited for, because a
// software rasteriser would take the real path for the wrong reason.
const quality = await page.evaluate(() => {
  const v = window.__vertigo;
  // Whatever the governor did during the real drive is its own business; reset
  // the budget so this check starts from a known place either way.
  const duringRun = { tier: v.tier, downgrades: v.governor.downgrades };
  v.governor.pin(null);
  v.applyTier('high', false);
  const before = { tier: v.tier, pixelRatio: v.renderer.renderer.getPixelRatio() };

  // Two seconds of 40 ms frames, straight into the governor.
  const verdicts = [];
  for (let i = 0; i < 400; i++) {
    const next = v.governor.sample(0.040);
    if (next) { verdicts.push(next); v.applyTier(next, true); }
  }
  v.session.render(1 / 60);
  return {
    duringRun,
    before,
    verdicts,
    tier: v.tier,
    rendererTier: v.renderer.tier,
    sessionTier: v.session.tier,
    pixelRatio: v.renderer.renderer.getPixelRatio(),
    particleBudget: v.session.vfx.budget,
    capacity: v.session.vfx.capacity,
    draws: v.renderer.drawCalls,
  };
});

if (quality.verdicts.length > 0 && quality.tier === quality.rendererTier
    && quality.tier === quality.sessionTier) {
  pass(`adaptive downgrade high -> ${quality.verdicts.join(' -> ')} applied everywhere `
    + `(pixel ratio ${quality.before.pixelRatio} -> ${quality.pixelRatio}, `
    + `particles ${quality.particleBudget}/${quality.capacity})`);
} else {
  fail(`adaptive downgrade did not apply cleanly: ${JSON.stringify(quality)}`);
}
if (quality.draws > 0) pass(`still drawing after the tier change (${quality.draws} calls)`);
else fail('the scene stopped drawing after a tier change');
console.log(`  info  during the live run the governor made ${quality.duringRun.downgrades} `
  + `downgrade(s), ending at tier "${quality.duringRun.tier}"`);

// --- Landscape ---------------------------------------------------------------
await page.setViewportSize({ width: 892, height: 412 });
await page.waitForTimeout(600);
const landscape = await page.evaluate(() => ({
  portrait: window.__vertigo.session.camera.portrait,
  fov: window.__vertigo.renderer.camera.fov,
  width: window.__vertigo.renderer.width,
}));
if (!landscape.portrait && landscape.width > 500) {
  pass(`rotated to landscape (fov ${landscape.fov.toFixed(1)}deg)`);
} else {
  fail(`landscape not picked up: ${JSON.stringify(landscape)}`);
}
await page.screenshot({ path: join(shots, '03-landscape.png') });

if (consoleErrors.length === 0) pass('clean console');
else fail(`${consoleErrors.length} console error(s):\n      ${consoleErrors.slice(0, 5).join('\n      ')}`);

await browser.close();
server.close();

console.log(`\nscreenshots: ${shots}`);
if (problems.length) {
  console.error(`\n${problems.length} check(s) failed\n`);
  process.exit(1);
}
console.log('\nall checks passed\n');
