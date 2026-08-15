/**
 * Adaptive quality downgrade.
 *
 * The governor is the one piece of the render path that makes a decision, and a
 * wrong decision here is very visible: a spurious downgrade takes shadows away
 * from a player whose device was fine, and a missed one leaves a struggling
 * phone at 20 fps for the whole race. Because it is pure arithmetic over frame
 * times, both failures are ordinary assertions.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { QUALITY } from '../src/config.js';
import { QualityGovernor, lowerTier, TIER_ORDER } from '../src/app/quality.js';

/** Feeds `n` frames of `ms` each, returning every verdict the governor gave. */
function feed(gov, ms, n) {
  const verdicts = [];
  for (let i = 0; i < n; i++) {
    const v = gov.sample(ms / 1000);
    if (v) verdicts.push(v);
  }
  return verdicts;
}

test('tier order steps down and stops at the bottom', () => {
  assert.deepEqual(TIER_ORDER, ['low', 'medium', 'high']);
  assert.equal(lowerTier('high'), 'medium');
  assert.equal(lowerTier('medium'), 'low');
  assert.equal(lowerTier('low'), null);
  assert.equal(lowerTier('nonsense'), null);
});

test('a comfortable frame rate never downgrades', () => {
  const gov = new QualityGovernor('high');
  // Ten seconds at 60 fps.
  assert.deepEqual(feed(gov, 16.7, 600), []);
  assert.equal(gov.tier, 'high');
  assert.equal(gov.downgrades, 0);
});

test('a partial window has no opinion, however slow it is', () => {
  const gov = new QualityGovernor('high');
  // 59 frames at 100 ms is nearly six seconds of misery - but the rolling mean
  // is not yet a rolling mean, so the governor must stay silent.
  assert.deepEqual(feed(gov, 100, 59), []);
  assert.equal(gov.tier, 'high');
});

test('sustained frame pressure drops exactly one tier', () => {
  const gov = new QualityGovernor('high');

  // Fill the window at 30 ms - over the 22 ms threshold from the first full
  // window onward, so the sustain clock starts as soon as the window fills.
  const verdicts = feed(gov, 30, gov.windowFrames);
  assert.deepEqual(verdicts, [], 'a full window alone is not two seconds of it');

  // 2 s of sustained 30 ms frames is 67 more frames.
  const more = feed(gov, 30, 67);
  assert.deepEqual(more, ['medium'], 'expected exactly one downgrade verdict');
  assert.equal(gov.tier, 'medium');
  assert.equal(gov.downgrades, 1);
});

test('the sustain clock is measured in seconds, not frames', () => {
  const gov = new QualityGovernor('high');
  // Filling the window at 30 ms already puts one over-threshold frame on the
  // clock: the mean is only meaningful from the sixtieth sample onward, and
  // that sixtieth sample is itself evidence.
  feed(gov, 30, gov.windowFrames);
  assert.ok(gov.overSeconds > 0 && gov.overSeconds < 0.05);

  const needed = Math.ceil((gov.sustainSeconds - gov.overSeconds) / 0.030);
  assert.deepEqual(feed(gov, 30, needed - 1), [], 'fired a frame early');
  assert.ok(gov.overSeconds < QUALITY.downgradeSustainSeconds);
  assert.deepEqual(feed(gov, 30, 1), ['medium'], 'did not fire on the frame it should');
});

test('frame times that recover reset the sustain clock', () => {
  const gov = new QualityGovernor('high');
  feed(gov, 30, gov.windowFrames);
  feed(gov, 30, 50);
  assert.ok(gov.overSeconds > 0, 'the clock should be running');

  // Enough good frames to pull the rolling mean back under the threshold.
  feed(gov, 8, gov.windowFrames);
  assert.equal(gov.overSeconds, 0, 'recovery must clear the clock, not pause it');

  // And the previously accumulated pressure must not carry over: another burst
  // of slow frames has to earn the full sustain window again from zero.
  assert.deepEqual(feed(gov, 30, gov.windowFrames + 40), []);
  assert.equal(gov.tier, 'high');
});

test('one stalled frame cannot trigger a downgrade on its own', () => {
  const gov = new QualityGovernor('high');
  feed(gov, 16.7, gov.windowFrames);
  // A tab restore: a single five-second "frame".
  assert.deepEqual(feed(gov, 5000, 1), []);
  // The mean is dragged up, but the clamp keeps it under the threshold, and the
  // sustain clock cannot bank five seconds from one sample.
  assert.ok(gov.meanFrameMs < QUALITY.downgradeFrameMs,
    `one clamped stall lifted the mean to ${gov.meanFrameMs.toFixed(1)} ms`);
  assert.ok(gov.overSeconds < QUALITY.downgradeSustainSeconds);
  assert.equal(gov.tier, 'high');
});

test('downgrades stop at the configured cap', () => {
  const gov = new QualityGovernor('high');
  const all = feed(gov, 60, 6000);
  assert.deepEqual(all, ['medium', 'low']);
  assert.equal(gov.downgrades, QUALITY.maxAutoDowngrades);
  assert.equal(gov.tier, 'low');
  assert.equal(gov.active, false);
  assert.equal(gov.exhausted, true);
});

test('the cap binds even when there is a tier left below', () => {
  const gov = new QualityGovernor('high', { maxDowngrades: 1 });
  assert.deepEqual(feed(gov, 60, 6000), ['medium']);
  assert.equal(gov.tier, 'medium');
  assert.equal(lowerTier(gov.tier), 'low', 'there is still a tier below');
  assert.equal(gov.active, false, 'but the budget is spent');
});

test('the governor never raises, however fast the frames get', () => {
  const gov = new QualityGovernor('high');
  // Stop at the first downgrade: left running, sustained 30 ms frames would
  // legitimately take it all the way to `low`.
  while (gov.tier === 'high') gov.sample(0.030);
  assert.equal(gov.tier, 'medium');
  // Hours of 120 fps must not win `high` back - only the player can.
  assert.deepEqual(feed(gov, 8, 20000), []);
  assert.equal(gov.tier, 'medium');
});

test('an explicit tier choice disables automatic adjustment', () => {
  const gov = new QualityGovernor('high', { userPinned: true });
  assert.equal(gov.active, false);
  assert.deepEqual(feed(gov, 200, 2000), [], 'a pinned tier must never be overruled');
  assert.equal(gov.tier, 'high');
  assert.equal(gov.downgrades, 0);
});

test('pinning mid-session stops a downgrade that was already brewing', () => {
  const gov = new QualityGovernor('high');
  feed(gov, 30, gov.windowFrames + 50);
  assert.ok(gov.overSeconds > 0);

  gov.pin('high');
  assert.equal(gov.overSeconds, 0);
  assert.deepEqual(feed(gov, 30, 2000), []);
  assert.equal(gov.tier, 'high');
});

test('choosing Auto hands control back and refunds the budget', () => {
  const gov = new QualityGovernor('high');
  feed(gov, 60, 6000);
  assert.equal(gov.tier, 'low');
  assert.equal(gov.active, false);

  gov.pin('high');
  assert.equal(gov.tier, 'high');
  gov.pin(null);
  assert.equal(gov.userPinned, false);
  assert.equal(gov.downgrades, 0);
  assert.equal(gov.active, true);
  assert.deepEqual(feed(gov, 60, 6000), ['medium', 'low']);
});

test('adopting a tier changed elsewhere keeps verdicts one step below reality', () => {
  const gov = new QualityGovernor('medium');
  while (gov.tier === 'medium') gov.sample(0.040);
  assert.equal(gov.tier, 'low');
  assert.equal(gov.active, false, 'nothing below low');

  // The player restarts at high from Settings and then switches back to Auto.
  gov.adopt('high');
  assert.equal(gov.tier, 'high');
  assert.equal(gov.userPinned, false, 'adopt must not change who is in charge');
  assert.equal(gov.downgrades, 1, 'nor refund the budget');
  assert.equal(gov.overSeconds, 0, 'nor keep evidence from the old tier');

  // One downgrade of budget left, and it steps down from high, not from low.
  const seen = [];
  for (let i = 0; i < 4000; i++) {
    const v = gov.sample(0.040);
    if (v) seen.push(v);
  }
  assert.deepEqual(seen, ['medium']);
});

test('pinning an unknown tier changes nothing', () => {
  const gov = new QualityGovernor('high');
  assert.equal(gov.pin('ultra'), 'high');
  assert.equal(gov.userPinned, false);
});

test('nonsense frame deltas are ignored rather than poisoning the mean', () => {
  const gov = new QualityGovernor('high');
  for (const bad of [0, -1, NaN, Infinity, undefined]) gov.sample(bad);
  assert.equal(gov.meanFrameMs, 0);
  assert.deepEqual(feed(gov, 16.7, 600), []);
});

test('the defaults are the ones config.js documents', () => {
  const gov = new QualityGovernor('high');
  assert.equal(gov.thresholdMs, QUALITY.downgradeFrameMs);
  assert.equal(gov.sustainSeconds, QUALITY.downgradeSustainSeconds);
  assert.equal(gov.maxDowngrades, QUALITY.maxAutoDowngrades);
  assert.equal(gov.windowFrames, 60);
});
