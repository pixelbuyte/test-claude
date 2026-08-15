/**
 * Entry point.
 *
 * Wires the canvas, input and one race together and drives the frame loop. This
 * is the only file in the project that talks to requestAnimationFrame or reads
 * the clock - everything below it advances in fixed STEP-sized slices.
 */
import { formatTime, ordinal } from './sim/math/scalar.js';
import { EV } from './sim/core/events.js';
import { stateName } from './sim/player/states.js';
import { buildPracticeLevel } from './data/levels/practice.js';
import { LEVELS } from './data/levels/index.js';
import { assembleLevel } from './sim/level/assemble.js';
import { Renderer } from './render/Renderer.js';
import { InputManager } from './input/InputManager.js';
import { RaceSession, PHASE } from './app/RaceSession.js';
import { SaveManager, targetsFor } from './sim/save/SaveManager.js';
import { bestAvailableAdapter } from './app/storage.js';

/**
 * Every course the player can pick, practice track first.
 *
 * Levels are assembled lazily: building all twelve up front would cost a second
 * of startup for eleven courses the player is not about to race.
 */
const COURSES = [
  {
    id: 'practice', name: 'Practice', theme: 'rooftops', seed: 7,
    build: buildPracticeLevel,
    roster: [{ name: 'Juno', skill: 'normal' }, { name: 'Pike', skill: 'easy' }],
  },
  ...LEVELS.map((def) => ({
    id: def.id, name: def.name, theme: def.theme, seed: def.seed,
    build: () => assembleLevel(def),
    roster: def.roster,
  })),
];

/** Picks a quality tier from what the device is willing to admit about itself. */
function detectTier() {
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  const dpr = window.devicePixelRatio || 1;
  if (cores <= 4 && memory <= 4) return 'low';
  if (cores >= 8 && memory >= 8 && dpr <= 2.5) return 'high';
  return 'medium';
}

function boot() {
  const canvas = document.getElementById('game');
  const el = (id) => document.getElementById(id);
  const hud = {
    time: el('hud-time'),
    rank: el('hud-rank'),
    coins: el('hud-coins'),
    speed: el('hud-speed'),
    state: el('hud-state'),
    progress: el('hud-progress-fill'),
    toast: el('toast'),
    overlay: el('overlay'),
    tagline: el('overlay-tagline'),
    grid: el('level-grid'),
    startButton: el('start-button'),
    countdown: el('countdown'),
    effects: el('effects'),
    results: el('results'),
    resultsBody: el('results-body'),
    resultsNotes: el('results-notes'),
    wallet: el('wallet'),
    stats: el('debug-stats'),
  };

  const storage = bestAvailableAdapter();
  const save = new SaveManager(storage.adapter);
  save.load();

  const tier = save.data.settings.qualityTier || detectTier();
  const renderer = new Renderer(canvas, { tier });
  const input = new InputManager().attach(canvas);

  let course = COURSES[0];
  let session = null;
  let resultsShown = false;
  let toastTimer = 0;
  let fps = 0;

  const toast = (text) => {
    hud.toast.textContent = text;
    hud.toast.classList.add('show');
    toastTimer = 1.2;
  };

  function handleEvent(e) {
    if (!session) return;
    const mine = e.actor === session.player.index;
    if (!mine && e.type !== EV.COUNTDOWN_TICK && e.type !== EV.RACE_START) return;

    switch (e.type) {
      case EV.VAULT: toast('Vault'); break;
      case EV.SLIDE_START: toast('Slide'); break;
      case EV.WALLRUN_START: toast('Wall run'); break;
      case EV.WALL_JUMP: toast('Wall jump'); break;
      case EV.MANTLE: toast('Mantle'); break;
      case EV.DOUBLE_JUMP: toast('Double jump'); break;
      case EV.LAUNCH_PAD: toast('Launch!'); break;
      case EV.CHECKPOINT: toast('Checkpoint'); break;
      case EV.CRASH: toast('Crash'); break;
      case EV.DEATH: toast('Respawning'); break;
      case EV.RANK_CHANGE: toast(ordinal(e.a)); break;
      case EV.COUNTDOWN_TICK:
        hud.countdown.textContent = e.a > 0 ? String(e.a) : 'GO';
        hud.countdown.classList.remove('pulse');
        // Restart the animation rather than letting a re-add be a no-op.
        void hud.countdown.offsetWidth;
        hud.countdown.classList.add('pulse');
        break;
      case EV.RACE_START:
        hud.countdown.classList.remove('pulse');
        hud.countdown.textContent = '';
        break;
      default: break;
    }
  }

  /** Tears down the previous race and builds one for the selected course. */
  function buildSession() {
    if (session) session.dispose();
    const level = course.build();
    session = new RaceSession(level, renderer, input, {
      roster: course.roster, seed: course.seed, tier,
    });
    session.onEvent = handleEvent;
    resultsShown = false;
    hud.results.classList.add('hidden');
    return session;
  }

  // --- Level select --------------------------------------------------------
  function renderGrid() {
    hud.wallet.textContent = `Level ${save.data.playerLevel} · ${save.data.coins} coins`
      + (storage.persistent ? '' : ' · not saving');
    hud.grid.innerHTML = '';
    for (const c of COURSES) {
      const button = document.createElement('button');
      button.type = 'button';
      const locked = c.def ? !save.isUnlocked(c.def) : false;
      const rec = save.levelRecord(c.id);
      button.className = `level-chip${c.id === course.id ? ' selected' : ''}`
        + `${locked ? ' locked' : ''}${rec.medal ? ` medal-${rec.medal}` : ''}`;
      button.dataset.courseId = c.id;
      button.disabled = locked;

      const detail = locked
        ? `Level ${c.def.unlockAt}`
        : rec.bestTime !== null ? formatTime(rec.bestTime) : c.theme;
      button.innerHTML = `<span class="level-name">${c.name}</span>`
        + `<span class="level-theme">${detail}</span>`;

      button.addEventListener('click', (e) => {
        e.stopPropagation();
        if (locked) return;
        course = c;
        renderGrid();
        hud.tagline.textContent = `${c.name} · ${c.roster.length + 1} racers`;
      });
      hud.grid.appendChild(button);
    }
  }

  /**
   * Draws the active power-up chips. Rebuilt only when the set actually changes,
   * so this is not touching the DOM sixty times a second during a race.
   */
  let effectsKey = '';
  function renderEffects(effects) {
    const shown = [];
    if (effects.shield > 0) shown.push(['shield', `${effects.shield}`, false]);
    if (effects.speed > 0) shown.push(['speed', effects.speed.toFixed(0), effects.speed < 1]);
    if (effects.magnet > 0) shown.push(['magnet', effects.magnet.toFixed(0), effects.magnet < 1]);
    if (effects.slowmo > 0) shown.push(['slowmo', effects.slowmo.toFixed(0), effects.slowmo < 1]);
    if (effects.invuln > 0) shown.push(['invuln', effects.invuln.toFixed(0), effects.invuln < 1]);

    const key = shown.map((e) => e.join(':')).join('|');
    if (key === effectsKey) return;
    effectsKey = key;

    hud.effects.innerHTML = shown.map(([name, value, expiring]) => `
      <span class="effect effect-${name}${expiring ? ' expiring' : ''}">
        <span class="effect-dot"></span>${name} ${value}
      </span>`).join('');
  }

  const showResults = () => {
    if (resultsShown) return;
    resultsShown = true;

    const results = session.results();
    const me = results.find((r) => r.isPlayer);
    const previousBest = save.bestTime(course.id);

    // Targets are derived from the player's own best rather than an authored
    // number, so a first finish always earns something and the bar then rises.
    const targets = previousBest ? targetsFor(previousBest) : null;
    const summary = save.recordRace(course.id, {
      placement: me.placement,
      time: me.time,
      dnf: me.dnf,
      coins: me.coins,
      deaths: session.player.deaths,
      distance: session.player.pos.z,
    }, targets);

    hud.resultsBody.innerHTML = results.map((r) => `
      <tr class="${r.isPlayer ? 'me' : ''}">
        <td>${r.placement}</td>
        <td>${r.name}</td>
        <td>${r.dnf ? 'DNF' : formatTime(r.time)}</td>
        <td>${r.coins}</td>
      </tr>`).join('');

    const notes = [];
    if (summary.improvedTime) notes.push('New best time');
    if (summary.improvedMedal) notes.push(`${summary.medal} medal`);
    if (summary.levelledUp) notes.push(`Level ${summary.levelAfter}`);
    notes.push(`+${summary.coinsEarned} coins`, `+${summary.xpEarned} XP`);
    if (!summary.persisted) notes.push('progress not saved - storage unavailable');
    hud.resultsNotes.textContent = notes.join(' · ');

    hud.results.classList.remove('hidden');
    renderGrid();
  };

  // --- Frame loop ----------------------------------------------------------
  let last = performance.now();
  let fpsAccum = 0;
  let fpsFrames = 0;

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.25);
    last = now;

    if (renderer.resize()) session.onResize();

    session.update(dt);
    session.render(dt);

    const s = session.hudState();
    hud.time.textContent = formatTime(s.time);
    hud.rank.textContent = `${s.rank}/${s.fieldSize}`;
    hud.coins.textContent = String(s.coins);
    hud.speed.textContent = s.speed.toFixed(1);
    hud.state.textContent = stateName(s.state);
    hud.progress.style.width = `${(s.progress * 100).toFixed(1)}%`;
    renderEffects(s.effects);

    if (s.phase === PHASE.FINISHED) showResults();

    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) hud.toast.classList.remove('show');
    }

    fpsAccum += dt;
    fpsFrames++;
    if (fpsAccum >= 0.5) {
      fps = fpsFrames / fpsAccum;
      fpsAccum = 0;
      fpsFrames = 0;
      hud.stats.textContent = `${fps.toFixed(0)} fps · ${renderer.drawCalls} draws · `
        + `${(renderer.triangles / 1000).toFixed(1)}k tris · ${tier}`;
    }

    requestAnimationFrame(frame);
  }

  // --- Lifecycle -----------------------------------------------------------
  const startRace = () => {
    hud.overlay.classList.add('hidden');
    buildSession();
    session.start();
    last = performance.now();
  };

  hud.startButton.addEventListener('click', (e) => {
    e.stopPropagation();
    startRace();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (!session || !session.running)) startRace();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && session) session.pause();
  });
  window.addEventListener('blur', () => { if (session) session.pause(); });

  // A handle for the smoke test to drive and inspect.
  window.__vertigo = {
    renderer, input, start: startRace,
    get session() { return session; },
    get level() { return session ? session.level : null; },
    get course() { return course; },
    selectCourse(id) {
      const found = COURSES.find((c) => c.id === id);
      if (found) { course = found; renderGrid(); }
      return !!found;
    },
    courses: COURSES.map((c) => c.id),
    get fps() { return fps; },
  };

  renderGrid();
  // Build one immediately so there is something behind the menu to look at.
  buildSession();
  requestAnimationFrame(frame);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
