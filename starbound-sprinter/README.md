# Starbound Sprinter

An original retro-style 2D side-scrolling platformer in a single self-contained
HTML file. No libraries, no external assets — all graphics are drawn with the
Canvas API and all sound is synthesized with the Web Audio API.

Open `index.html` in any modern browser, or play the deployed build.

## Controls
- **Move:** ← / → or A / D
- **Jump:** Space / W / ↑ (hold for higher jumps)
- **Run:** Shift
- **Pause:** P · **Mute:** M · **Restart (after game over / win):** R
- **Mobile:** on-screen touch buttons appear on touch devices

## Features
- 3 hand-designed levels — Verdant Vale (grass), Crystal Caverns (cave with
  moving platforms), Emberforge Keep (castle/lava + boss)
- Momentum physics: acceleration, friction, gravity, variable-height jumps,
  coyote time and jump buffering
- Enemies that patrol and turn at ledges; stomp to defeat, side-hits hurt you
- Coins, gems, `?`-blocks, breakable bricks, three power-up types
  (health/grow, speed, high-jump), checkpoints, lives + health, score, timer
- Moving platforms that carry the player, lava hazards, a 3-hit boss, and an
  end portal that opens after the boss is defeated
- Parallax backgrounds, animated sprites, particles, and synth sound effects

## Code layout
Everything lives in `index.html`, organized into clearly commented sections:
canvas setup, audio, input, level data/loader, player, enemies, moving
platforms, collectibles/power-ups, collision, camera, UI, game state, and the
fixed-timestep game loop.
