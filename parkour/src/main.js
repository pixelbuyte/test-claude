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
import { Renderer } from './render/Renderer.js';
import { InputManager } from './input/InputManager.js';
import { RaceSession, PHASE } from './app/RaceSession.js';

/** The opponent field. Names and skills only; everything else is derived. */
const ROSTER = [
  { name: 'Vex', skill: 'hard' },
  { name: 'Juno', skill: 'normal' },
  { name: 'Pike', skill: 'normal' },
  { name: 'Sable', skill: 'easy' },
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
    countdown: el('countdown'),
    results: el('results'),
    resultsBody: el('results-body'),
    stats: el('debug-stats'),
  };

  const tier = detectTier();
  const renderer = new Renderer(canvas, { tier });
  const input = new InputManager().attach(canvas);
  const level = buildPracticeLevel();
  const session = new RaceSession(level, renderer, input, {
    roster: ROSTER, seed: 7, tier,
  });

  let toastTimer = 0;
  const toast = (text) => {
    hud.toast.textContent = text;
    hud.toast.classList.add('show');
    toastTimer = 1.2;
  };

  session.onEvent = (e) => {
    if (e.actor !== session.player.index && e.type !== EV.COUNTDOWN_TICK
      && e.type !== EV.RACE_START) return;
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
        // Restart the animation rather than letting it be a no-op.
        void hud.countdown.offsetWidth;
        hud.countdown.classList.add('pulse');
        break;
      case EV.RACE_START:
        hud.countdown.classList.remove('pulse');
        hud.countdown.textContent = '';
        break;
      default: break;
    }
  };

  let resultsShown = false;
  const showResults = () => {
    if (resultsShown) return;
    resultsShown = true;
    const rows = session.results().map((r) => `
      <tr class="${r.isPlayer ? 'me' : ''}">
        <td>${r.placement}</td>
        <td>${r.name}</td>
        <td>${r.dnf ? 'DNF' : formatTime(r.time)}</td>
        <td>${r.coins}</td>
      </tr>`).join('');
    hud.resultsBody.innerHTML = rows;
    hud.results.classList.remove('hidden');
  };

  // --- Frame loop ----------------------------------------------------------
  let last = performance.now();
  let fpsAccum = 0;
  let fpsFrames = 0;
  let fps = 0;

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
    hud.speed.textContent = `${s.speed.toFixed(1)} m/s`;
    hud.state.textContent = stateName(s.state);
    hud.progress.style.width = `${(s.progress * 100).toFixed(1)}%`;

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
    session.start();
    last = performance.now();
  };

  hud.overlay.addEventListener('click', startRace);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !session.running) startRace();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) session.pause();
  });
  window.addEventListener('blur', () => session.pause());

  // A handle for the smoke test to drive and inspect.
  window.__vertigo = {
    session, renderer, input, level, start: startRace,
    get fps() { return fps; },
  };

  requestAnimationFrame(frame);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
