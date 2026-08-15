/**
 * Input, normalised into one intent shape.
 *
 * Touch and keyboard produce exactly the same thing: a lateral target in
 * [-1, 1] plus edge-triggered jump and slide. The simulation never learns which
 * one the player used, which is why the desktop build and the phone build cannot
 * drift apart in feel.
 *
 * Edges are consumed by the simulation, not cleared on a timer - a tap during a
 * long frame still registers on the next substep rather than being lost.
 */
import { makeIntent } from '../sim/player/PlayerController.js';

/** A swipe must travel this far, in CSS pixels, to count. */
const SWIPE_DISTANCE = 34;
/** ...and must do it within this long, or it is a drag, not a swipe. */
const SWIPE_TIME_MS = 420;

export class InputManager {
  constructor(target = window) {
    this.target = target;
    this.intent = makeIntent();
    this.enabled = true;

    /** Steering held by touch drag, separate from the keyboard's axis. */
    this._touchLateral = 0;
    this._keyLateral = 0;
    this._keys = new Set();

    this._pointerId = -1;
    this._startX = 0;
    this._startY = 0;
    this._startT = 0;
    this._swiped = false;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
  }

  attach(element) {
    this.element = element || this.target;
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    this.element.addEventListener('pointerdown', this._onPointerDown);
    this.element.addEventListener('pointermove', this._onPointerMove);
    this.element.addEventListener('pointerup', this._onPointerUp);
    this.element.addEventListener('pointercancel', this._onPointerUp);
    return this;
  }

  detach() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    if (!this.element) return;
    this.element.removeEventListener('pointerdown', this._onPointerDown);
    this.element.removeEventListener('pointermove', this._onPointerMove);
    this.element.removeEventListener('pointerup', this._onPointerUp);
    this.element.removeEventListener('pointercancel', this._onPointerUp);
  }

  // --- Keyboard -------------------------------------------------------------

  _onKeyDown(e) {
    if (!this.enabled || e.repeat) return;
    const k = e.key.toLowerCase();
    this._keys.add(k);

    if (k === 'arrowup' || k === 'w' || k === ' ') {
      this.intent.jumpPressed = true;
      this.intent.jumpHeld = true;
      e.preventDefault();
    }
    if (k === 'arrowdown' || k === 's' || k === 'shift') {
      this.intent.slidePressed = true;
      this.intent.slideHeld = true;
      e.preventDefault();
    }
    this._updateKeyLateral();
  }

  _onKeyUp(e) {
    const k = e.key.toLowerCase();
    this._keys.delete(k);
    if (k === 'arrowup' || k === 'w' || k === ' ') this.intent.jumpHeld = false;
    if (k === 'arrowdown' || k === 's' || k === 'shift') this.intent.slideHeld = false;
    this._updateKeyLateral();
  }

  _updateKeyLateral() {
    const left = this._keys.has('arrowleft') || this._keys.has('a');
    const right = this._keys.has('arrowright') || this._keys.has('d');
    this._keyLateral = (right ? 1 : 0) - (left ? 1 : 0);
  }

  // --- Touch ---------------------------------------------------------------

  _onPointerDown(e) {
    if (!this.enabled || this._pointerId !== -1) return;
    this._pointerId = e.pointerId;
    this._startX = e.clientX;
    this._startY = e.clientY;
    this._startT = e.timeStamp;
    this._swiped = false;
    if (this.element.setPointerCapture) this.element.setPointerCapture(e.pointerId);
  }

  _onPointerMove(e) {
    if (e.pointerId !== this._pointerId) return;
    const dx = e.clientX - this._startX;
    const dy = e.clientY - this._startY;

    // Steering is absolute across the screen width rather than relative to the
    // touch, so the player can place a thumb anywhere and still reach both lanes.
    const halfWidth = (this.element.clientWidth || window.innerWidth) * 0.32;
    this._touchLateral = Math.max(-1, Math.min(1, dx / halfWidth));

    if (this._swiped) return;
    if (e.timeStamp - this._startT > SWIPE_TIME_MS) return;

    if (dy < -SWIPE_DISTANCE && Math.abs(dy) > Math.abs(dx)) {
      this.intent.jumpPressed = true;
      this.intent.jumpHeld = true;
      this._swiped = true;
    } else if (dy > SWIPE_DISTANCE && Math.abs(dy) > Math.abs(dx)) {
      this.intent.slidePressed = true;
      this.intent.slideHeld = true;
      this._swiped = true;
    }
  }

  _onPointerUp(e) {
    if (e.pointerId !== this._pointerId) return;

    // A tap that never became a swipe is a jump. It is the single most common
    // input in the game, so it gets the least demanding gesture.
    const dt = e.timeStamp - this._startT;
    const dx = e.clientX - this._startX;
    const dy = e.clientY - this._startY;
    if (!this._swiped && dt < 260 && Math.abs(dx) < 20 && Math.abs(dy) < 20) {
      this.intent.jumpPressed = true;
    }

    this._pointerId = -1;
    this._touchLateral = 0;
    this._swiped = false;
    this.intent.jumpHeld = false;
    this.intent.slideHeld = false;
  }

  // --- Per-frame ------------------------------------------------------------

  /** Folds the two steering sources together. Call once per rendered frame. */
  update() {
    const lateral = this._pointerId !== -1 ? this._touchLateral : this._keyLateral;
    this.intent.lateralTarget = lateral;
    return this.intent;
  }

  /** Drops any held state - use when the game is paused or loses focus. */
  reset() {
    this._keys.clear();
    this._keyLateral = 0;
    this._touchLateral = 0;
    this._pointerId = -1;
    this.intent.lateralTarget = 0;
    this.intent.jumpPressed = false;
    this.intent.jumpHeld = false;
    this.intent.slidePressed = false;
    this.intent.slideHeld = false;
  }
}
