/**
 * Entry point.
 *
 * Wires the canvas, input and one practice run together and drives the frame
 * loop. This is the only file in the project that talks to requestAnimationFrame
 * or reads the clock - everything below it advances in fixed STEP-sized slices.
 */
import { QUALITY, MOVEMENT } from './config.js';
import { formatTime } from './sim/math/scalar.js';
import { EV } from './sim/core/events.js';
import { stateName } from './sim/player/states.js';
import { buildPracticeLevel } from './data/levels/practice.js';
import { Renderer } from './render/Renderer.js';
import { InputManager } from './input/InputManager.js';
import { RaceSession } from './app/RaceSession.js';

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
  const hud = {
    time: document.getElementById('hud-time'),
    speed: document.getElementById('hud-speed'),
    coins: document.getElementById('hud-coins'),
    state: document.getElementById('hud-state'),
    progress: document.getElementById('hud-progress-fill'),
    toast: document.getElementById('toast'),
    overlay: document.getElementById('overlay'),
    stats: document.getElementById('debug-stats'),
  };

  const tier = detectTier();
  const renderer = new Renderer(canvas, { tier });
  const input = new InputManager().attach(canvas);
  const level = buildPracticeLevel();
  const session = new RaceSession(level, renderer, input);

  let toastTimer = 0;
  const toast = (text) => {
    hud.toast.textContent = text;
    hud.toast.classList.add('show');
    toastTimer = 1.4;
  };

  session.onEvent = (e) => {
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
      case EV.FINISH: toast('Finish!'); break;
      default: break;
    }
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

    // --- HUD ---------------------------------------------------------------
    const p = session.player;
    hud.time.textContent = formatTime(session.elapsed);
    hud.speed.textContent = `${p.speed.toFixed(1)} m/s`;
    hud.coins.textContent = String(p.coins);
    hud.state.textContent = stateName(p.state);
    hud.progress.style.width = `${(session.world.progressOf(p.pos.z) * 100).toFixed(1)}%`;

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
      hud.stats.textContent =
        `${fps.toFixed(0)} fps · ${renderer.drawCalls} draws · ${(renderer.triangles / 1000).toFixed(1)}k tris · ${tier}`;
    }

    requestAnimationFrame(frame);
  }

  // --- Lifecycle -----------------------------------------------------------
  const startRun = () => {
    hud.overlay.classList.add('hidden');
    session.start();
    last = performance.now();
  };

  hud.overlay.addEventListener('click', startRun);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !session.running) startRun();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) session.pause();
  });

  window.addEventListener('blur', () => session.pause());

  // Expose a handle for the smoke test to drive and inspect.
  window.__vertigo = { session, renderer, input, level, start: startRun, get fps() { return fps; } };

  requestAnimationFrame(frame);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
