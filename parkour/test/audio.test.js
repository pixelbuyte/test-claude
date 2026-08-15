/**
 * Audio and VFX, as far as Node can see them.
 *
 * Neither Web Audio nor WebGL exists here, so these test the parts that are
 * plain logic: that the manager degrades instead of throwing when there is no
 * AudioContext, that the music tables are coherent, and that the clock format
 * the HUD uses actually fits. The rest is covered by the browser smoke test,
 * which asserts a running AudioContext and a live particle pool.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { AudioManager } from '../src/audio/AudioManager.js';
import { BEDS, THEME_BED, musicBedFor } from '../src/audio/music.js';
import { THEMES } from '../src/data/themes.js';
import { formatClock, formatTime } from '../src/sim/math/scalar.js';
import { EV } from '../src/sim/core/events.js';

test('the audio manager is inert without a browser, never broken', () => {
  const audio = new AudioManager();

  // No window, so start() must fail softly rather than throw.
  assert.equal(audio.start(), false);
  assert.equal(audio.started, false);

  // And every method stays safe to call afterwards.
  assert.doesNotThrow(() => {
    audio.handle({ type: EV.JUMP, actor: 0, a: 0, b: 0, c: 0 }, 0);
    audio.updateFootsteps(0.016, { grounded: true, speed: 12, groundSurface: 0 });
    audio.playMusic('rooftops');
    audio.stopMusic();
    audio.setEnabled(false);
    audio.resume();
    audio.suspend();
    audio.dispose();
  });
});

test('a disabled manager does not try to start', () => {
  const audio = new AudioManager({ enabled: false });
  assert.equal(audio.start(), false);
  assert.equal(audio.enabled, false);
});

test('musicBedFor tolerates a missing context', () => {
  assert.equal(musicBedFor(null, null, 'rooftops'), null);
});

test('every theme maps to a bed that exists', () => {
  for (const id of Object.keys(THEMES)) {
    const bedName = THEME_BED[id];
    assert.ok(bedName, `theme ${id} has no music bed`);
    assert.ok(BEDS[bedName], `theme ${id} maps to missing bed ${bedName}`);
  }
});

test('every bed is a coherent 16-step pattern', () => {
  for (const [name, bed] of Object.entries(BEDS)) {
    assert.equal(bed.kick.length, 16, `${name} kick pattern is not a bar`);
    assert.equal(bed.hat.length, 16, `${name} hat pattern is not a bar`);
    assert.ok(bed.bpm > 60 && bed.bpm < 200, `${name} bpm ${bed.bpm} is implausible`);
    assert.ok(bed.arp.length > 0, `${name} has no arpeggio`);
    assert.ok(bed.kick.some((v) => v === 1), `${name} has no kick at all`);
  }
});

test('the live clock stays narrow and the record clock stays precise', () => {
  assert.equal(formatClock(0), '0:00.00');
  assert.equal(formatClock(61.5), '1:01.50');
  assert.equal(formatTime(61.5), '1:01.500');

  // The HUD tile is sized for this; a longer string overflows it on a phone.
  assert.ok(formatClock(599.99).length <= 8,
    `live clock got too wide: ${formatClock(599.99)}`);
  assert.equal(formatClock(-1), '--:--.--');
  assert.equal(formatClock(NaN), '--:--.--');
});
