/**
 * Chase camera, as pure numbers.
 *
 * Lives in sim/ rather than render/ because the framing is a gameplay decision,
 * not a drawing one: how far the camera sits back and how far ahead it looks are
 * what make a gap readable in time to jump it. Keeping it here means it is
 * testable without a browser, and that the same framing can be replayed exactly.
 *
 * Produces position / look-at / fov. Something in render/ copies those onto an
 * actual camera object; nothing here knows that object exists.
 */
import { STEP, CAMERA, BODY, MOVEMENT, LEVEL, kindMask, KIND } from '../../config.js';
import { clamp, clamp01, damp, lerp } from '../math/scalar.js';
import { makeAABB, setBoxAABB } from '../world/colliderSet.js';
import { overlapBox } from '../world/sweep.js';

const BLOCKERS = kindMask(KIND.SOLID, KIND.RAMP, KIND.WALLRUNNABLE, KIND.VAULTABLE, KIND.PLATFORM);

export function makeCamera() {
  return {
    pos: { x: 0, y: CAMERA.height, z: -CAMERA.boomNear },
    look: { x: 0, y: 1, z: 0 },
    fov: CAMERA.fovLandscape,

    /** Current boom length after anti-clip adjustment. */
    boom: CAMERA.boomNear,
    boomTarget: CAMERA.boomNear,

    shake: 0,
    shakeTime: 0,
    shakeOffsetX: 0,
    shakeOffsetY: 0,

    /** Set false to disable shake entirely (prefers-reduced-motion). */
    allowShake: true,
    portrait: false,

    _initialised: false,
    _probe: makeAABB(),
    _hits: new Int32Array(16),
  };
}

/** Snaps the camera behind a racer with no easing - use on race start / respawn. */
export function resetCamera(cam, p) {
  cam.boom = CAMERA.boomNear;
  cam.boomTarget = CAMERA.boomNear;
  cam.pos.x = p.pos.x;
  cam.pos.y = p.pos.y + CAMERA.height;
  cam.pos.z = p.pos.z - CAMERA.boomNear;
  cam.look.x = p.pos.x;
  cam.look.y = p.pos.y + BODY.height * BODY.anchorY;
  cam.look.z = p.pos.z + CAMERA.lookAheadBase;
  cam.shake = 0;
  cam._initialised = true;
}

export function addShake(cam, amount) {
  if (!cam.allowShake) return;
  cam.shake = Math.min(1.2, cam.shake + amount);
}

/**
 * Advances the camera one substep.
 *
 * @param {object} p      the racer being followed
 * @param {object} world  used only for the anti-clip probe
 */
export function stepCamera(cam, p, world) {
  if (!cam._initialised) resetCamera(cam, p);

  const speedT = clamp01(p.speed / MOVEMENT.speedMax);

  // --- Where the camera wants to be ---------------------------------------
  cam.boomTarget = lerp(CAMERA.boomNear, CAMERA.boomFar, speedT);
  const boom = antiClip(cam, p, world);

  const wantX = p.pos.x * 0.75;
  const wantY = p.pos.y + CAMERA.height;
  const wantZ = p.pos.z - boom;

  cam.pos.x = damp(cam.pos.x, wantX, CAMERA.followOmega, STEP);

  // Vertical follow is deliberately slacker in the air than on the ground, so
  // the runner climbs within the frame rather than staying pinned to one height
  // while the world drops around them. Snapping back to the tight rate on
  // contact is what makes a landing feel like it arrives.
  const omegaY = p.grounded ? CAMERA.followOmega : CAMERA.followOmegaAir;
  cam.pos.y = damp(cam.pos.y, wantY, omegaY, STEP);

  // ...but never so far behind that the runner leaves the top of the screen.
  // Lag is a feel device; losing sight of the player is a bug.
  const floorY = wantY - CAMERA.maxVerticalTrail;
  if (cam.pos.y < floorY) cam.pos.y = floorY;
  // Forward is not damped: falling behind the runner reads as lag, not weight.
  cam.pos.z = wantZ;

  // --- Where it looks ------------------------------------------------------
  const lookAhead = CAMERA.lookAheadBase + CAMERA.lookAheadPerSpeed * p.speed;
  let lookY = p.pos.y + BODY.height * BODY.anchorY;

  // Anticipation: lift the gaze toward whatever the runner is about to meet, so
  // the obstacle is on screen while there is still time to react to it.
  const a = p.affordances;
  if (a) {
    // `gapValid`, not `gapDistance > 0`: the probe reports its own range when
    // it finds nothing, so the old test was true below about 15 m/s whatever
    // the floor looked like - the anticipation tilt was permanently on and
    // therefore said nothing.
    if (a.gapValid && a.gapDistance < lookAhead) {
      lookY -= CAMERA.anticipationStrength * 0.25;
    }
    if (a.vaultValid || a.ledgeValid) {
      lookY += CAMERA.anticipationStrength * 0.35;
    }
  }

  cam.look.x = damp(cam.look.x, p.pos.x * 0.9, CAMERA.lookOmega, STEP);
  cam.look.y = damp(cam.look.y, lookY, CAMERA.lookOmega, STEP);
  cam.look.z = p.pos.z + lookAhead;

  // --- FOV -----------------------------------------------------------------
  const base = cam.portrait ? CAMERA.fovPortrait : CAMERA.fovLandscape;
  const wantFov = base + CAMERA.fovSpeedKick * speedT;
  cam.fov = damp(cam.fov, wantFov, CAMERA.fovOmega, STEP);

  // --- Shake ---------------------------------------------------------------
  if (cam.shake > 0) {
    cam.shakeTime += STEP;
    cam.shake = Math.max(0, cam.shake - CAMERA.shakeDecay * STEP * cam.shake);
    // Multi-frequency so it reads as impact rather than a sine wobble.
    const t = cam.shakeTime;
    cam.shakeOffsetX = cam.shake * (Math.sin(t * 47) * 0.06 + Math.sin(t * 23) * 0.04);
    cam.shakeOffsetY = cam.shake * (Math.sin(t * 39) * 0.05 + Math.sin(t * 61) * 0.03);
    if (cam.shake < 1e-3) {
      cam.shake = 0;
      cam.shakeOffsetX = 0;
      cam.shakeOffsetY = 0;
    }
  } else {
    cam.shakeOffsetX = 0;
    cam.shakeOffsetY = 0;
  }

  return cam;
}

/**
 * Shortens the boom when geometry sits between camera and runner.
 *
 * Pulls in quickly and eases back out slowly: a camera that snaps outward the
 * instant a wall ends is far more distracting than one that lingers.
 */
function antiClip(cam, p, world) {
  let allowed = cam.boomTarget;
  const probe = cam._probe;
  const r = CAMERA.clipRadius;

  // Narrow the collider set to the span the boom actually sweeps, first.
  //
  // `world.candidates` is a single shared buffer refreshed per racer per
  // substep, and the camera steps after the whole field has moved - so this
  // probe was reading whichever opponent happened to be stepped last, whose
  // bucket can be ninety metres up the course. The anti-clip was therefore
  // testing geometry nowhere near the camera and silently doing nothing:
  // configured, costed, and dead. Nothing downstream in the substep reads the
  // list after this, so refreshing it here is free of side effects.
  world.refresh(p.pos.z - cam.boomTarget * 0.5, cam.boomTarget * 0.5 + r + 1);

  for (let s = 1; s <= CAMERA.clipSamples; s++) {
    const t = s / CAMERA.clipSamples;
    const d = cam.boomTarget * t;
    const x = p.pos.x;
    const y = p.pos.y + lerp(BODY.height * BODY.anchorY, CAMERA.height, t);
    const z = p.pos.z - d;
    setBoxAABB(probe, x - r, y - r, z - r, x + r, y + r, z + r);
    if (overlapBox(probe, world.cs, world.candidates, world.candidateCount, BLOCKERS, cam._hits) > 0) {
      // Retreat to the last sample that actually probed clear, not to this one
      // minus the probe radius. Samples are boomTarget/clipSamples apart -
      // nearly two metres - which is four times the radius, so subtracting the
      // radius left the camera up to a sample-width inside the very thing it
      // was avoiding. Backing off to known-clear ground is slightly
      // conservative and always correct.
      allowed = Math.min(allowed, (s - 1) / CAMERA.clipSamples * cam.boomTarget);
      break;
    }
  }
  allowed = Math.max(1.2, allowed);

  const time = allowed < cam.boom ? CAMERA.clipPullInTime : CAMERA.clipPushOutTime;
  // damp() takes a rate; convert the time constant into one.
  cam.boom = damp(cam.boom, allowed, 1 / Math.max(time, 1e-3), STEP);
  return cam.boom;
}

/** Chooses FOV basis from the viewport aspect. Called by the view layer on resize. */
export function setAspectMode(cam, width, height) {
  cam.portrait = height > width;
  return cam.portrait;
}
