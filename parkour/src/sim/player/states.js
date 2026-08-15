/**
 * Player state machine definition.
 *
 * States are data, not code: the table below declares what each state means to
 * physics (does gravity apply, is the body short, is motion scripted) and to
 * animation (which clip). The controller reads the table rather than branching
 * on state names, so adding a state is a data change plus one handler.
 */
import { PARKOUR } from '../../config.js';

export const STATE = {
  IDLE: 0,
  RUN: 1,
  SPRINT: 2,
  JUMP: 3,
  FALL: 4,
  LAND: 5,
  SLIDE: 6,
  VAULT: 7,
  WALLRUN: 8,
  WALLJUMP: 9,
  LEDGE: 10,
  MANTLE: 11,
  STUMBLE: 12,
  RAIL: 13,
  DEAD: 14,
  VICTORY: 15,
  DEFEAT: 16,
};

export const STATE_COUNT = 17;

/**
 * @typedef {object} StateInfo
 * @property {string} name
 * @property {number} maxDuration  seconds; 0 means the state is unbounded
 * @property {boolean} scripted    motion is driven by a curve, not by gravity
 * @property {boolean} crouched    body uses the reduced slide height
 * @property {boolean} airborne    the state implies no ground contact
 * @property {boolean} terminal    the race is over for this racer
 * @property {string} clip         animation clip id
 */

/** Indexed by STATE value. */
export const STATE_INFO = [
  { name: 'idle', maxDuration: 0, scripted: false, crouched: false, airborne: false, terminal: false, clip: 'idle' },
  { name: 'run', maxDuration: 0, scripted: false, crouched: false, airborne: false, terminal: false, clip: 'run' },
  { name: 'sprint', maxDuration: 0, scripted: false, crouched: false, airborne: false, terminal: false, clip: 'sprint' },
  { name: 'jump', maxDuration: 2.5, scripted: false, crouched: false, airborne: true, terminal: false, clip: 'jumpUp' },
  { name: 'fall', maxDuration: 0, scripted: false, crouched: false, airborne: true, terminal: false, clip: 'fall' },
  { name: 'land', maxDuration: 0.18, scripted: false, crouched: false, airborne: false, terminal: false, clip: 'land' },
  { name: 'slide', maxDuration: PARKOUR.slideDuration + 0.5, scripted: false, crouched: true, airborne: false, terminal: false, clip: 'slide' },
  { name: 'vault', maxDuration: PARKOUR.vaultDuration, scripted: true, crouched: false, airborne: true, terminal: false, clip: 'vault' },
  { name: 'wallrun', maxDuration: PARKOUR.wallRunMaxTime, scripted: false, crouched: false, airborne: true, terminal: false, clip: 'wallrun' },
  { name: 'walljump', maxDuration: 0.3, scripted: false, crouched: false, airborne: true, terminal: false, clip: 'wallJump' },
  { name: 'ledge', maxDuration: PARKOUR.ledgeLatchTime, scripted: true, crouched: false, airborne: true, terminal: false, clip: 'ledgeGrab' },
  { name: 'mantle', maxDuration: PARKOUR.mantleDuration, scripted: true, crouched: false, airborne: true, terminal: false, clip: 'mantle' },
  { name: 'stumble', maxDuration: PARKOUR.stumbleDuration, scripted: false, crouched: false, airborne: false, terminal: false, clip: 'stumble' },
  { name: 'rail', maxDuration: 0, scripted: false, crouched: false, airborne: false, terminal: false, clip: 'run' },
  { name: 'dead', maxDuration: 0, scripted: true, crouched: false, airborne: true, terminal: false, clip: 'stumble' },
  { name: 'victory', maxDuration: 0, scripted: false, crouched: false, airborne: false, terminal: true, clip: 'victory' },
  { name: 'defeat', maxDuration: 0, scripted: false, crouched: false, airborne: false, terminal: true, clip: 'defeat' },
];

export function stateName(s) {
  return STATE_INFO[s] ? STATE_INFO[s].name : `unknown(${s})`;
}

export function isAirborneState(s) {
  return STATE_INFO[s].airborne;
}

export function isScripted(s) {
  return STATE_INFO[s].scripted;
}

export function isCrouched(s) {
  return STATE_INFO[s].crouched;
}

export function isTerminal(s) {
  return STATE_INFO[s].terminal;
}

/**
 * Legal transitions. A missing entry means "reachable from anywhere", which is
 * true of the failure states; the fuzz test asserts we never land outside the
 * table entirely.
 */
export const ALWAYS_REACHABLE = new Set([
  STATE.FALL, STATE.STUMBLE, STATE.DEAD, STATE.LAND, STATE.RUN,
  STATE.VICTORY, STATE.DEFEAT,
]);

export function isValidState(s) {
  return Number.isInteger(s) && s >= 0 && s < STATE_COUNT;
}
