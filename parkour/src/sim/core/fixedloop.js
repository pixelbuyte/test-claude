/**
 * Fixed-timestep accumulator.
 *
 * Rendering interpolates between the previous and current simulation states
 * using `alpha`, so motion stays smooth on any display refresh rate while the
 * simulation itself always advances in identical STEP-sized slices.
 */
import { STEP, MAX_SUBSTEPS, MAX_FRAME_DELTA } from '../../config.js';

export function createStepper(step = STEP, maxSubsteps = MAX_SUBSTEPS) {
  return {
    step,
    maxSubsteps,
    accumulator: 0,
    alpha: 0,
    /** Substeps skipped because the frame delta exceeded the budget. */
    droppedSteps: 0,
  };
}

/**
 * Feeds a wall-clock delta in and returns how many simulation steps to run.
 * Updates `stepper.alpha` for render interpolation.
 *
 * The clamps matter: without them a backgrounded tab returns with a huge delta
 * and the sim tries to catch up in one frame, which stalls and then compounds.
 */
export function advance(stepper, deltaSeconds) {
  let dt = deltaSeconds;
  if (!Number.isFinite(dt) || dt < 0) dt = 0;
  if (dt > MAX_FRAME_DELTA) dt = MAX_FRAME_DELTA;

  stepper.accumulator += dt;

  let steps = Math.floor(stepper.accumulator / stepper.step);
  if (steps > stepper.maxSubsteps) {
    stepper.droppedSteps += steps - stepper.maxSubsteps;
    // Discard the backlog rather than carry it forward into the next frame.
    stepper.accumulator -= (steps - stepper.maxSubsteps) * stepper.step;
    steps = stepper.maxSubsteps;
  }

  stepper.accumulator -= steps * stepper.step;
  stepper.alpha = stepper.accumulator / stepper.step;
  return steps;
}

export function resetStepper(stepper) {
  stepper.accumulator = 0;
  stepper.alpha = 0;
  stepper.droppedSteps = 0;
}
