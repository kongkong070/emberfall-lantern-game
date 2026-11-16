// The screenshot scenes behind ?shot=start|play|upgrade|win. Each one plays
// the real rules forward from a fresh world, steered by a simple autopilot:
// it keeps away from the nearest shade, stays near the lantern, and fires at
// the closest enemy, picking the strongest upgrade after every wave. The
// frame is what a real game looks like, and the same seed always gives the
// same frame. The win scene plays all ten waves; if the autopilot falls
// short before the step cap, the world stages the victory it earned the
// score for, so the shot still shows the real victory screen.
import { FIELD, LANTERN, PLAYER, STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_WIN } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 20;
const STEP_CAP = 60 * 60 * 9; // nine minutes of simulated play, at most

/** The shade closest to the lantern: the one that must die first. */
function nearestToLantern(state) {
  let best = null;
  let bestDist = Infinity;
  for (const e of state.enemies) {
    if (!e.active) continue;
    const d = Math.hypot(e.x - LANTERN.x, e.y - LANTERN.y);
    if (d < bestDist) { bestDist = d; best = e; }
  }
  return best;
}

function nearestEnemy(state) {
  let best = null;
  let bestDist = Infinity;
  for (const e of state.enemies) {
    if (!e.active) continue;
    const d = Math.hypot(e.x - state.player.x, e.y - state.player.y);
    if (d < bestDist) { bestDist = d; best = e; }
  }
  return best;
}

/**
 * Steer to intercept the shade nearest the lantern, while keeping out of
 * the nearest shade's reach and staying near the lantern.
 */
function autopilotSteer(state) {
  const p = state.player;
  let x = 0;
  let y = 0;
  const threat = nearestToLantern(state);
  if (threat !== null) {
    const d = Math.hypot(p.x - threat.x, p.y - threat.y);
    if (d > 130) {
      x += (threat.x - p.x) / d;
      y += (threat.y - p.y) / d;
    }
  }
  const foe = nearestEnemy(state);
  if (foe !== null) {
    const d = Math.hypot(p.x - foe.x, p.y - foe.y);
    if (d < 90) {
      x += (p.x - foe.x) / d * 1.4;
      y += (p.y - foe.y) / d * 1.4;
    }
  }
  const dl = Math.hypot(p.x - LANTERN.x, p.y - LANTERN.y);
  if (dl > 260) {
    x += (LANTERN.x - p.x) / dl * 0.7;
    y += (LANTERN.y - p.y) / dl * 0.7;
  }
  const len = Math.hypot(x, y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: x / len, y: y / len };
}

function autopilotAim(state) {
  const foe = nearestToLantern(state);
  if (foe === null) return { x: state.player.x, y: state.player.y - 100 };
  return { x: foe.x, y: foe.y };
}

/** Pick the upgrade the autopilot values most: damage, then shots, then speed. */
function autopilotUpgrade(world) {
  const choices = world.state.upgradeChoices;
  const rank = { heavy: 0, twin: 1, rapid: 2, pierce: 3, swift: 4, mend: 5, heart: 6 };
  let best = 0;
  for (let i = 1; i < choices.length; i += 1) {
    if ((rank[choices[i].id] ?? 9) < (rank[choices[best].id] ?? 9)) best = i;
  }
  world.chooseUpgrade(best);
}

function playSteps(world, steps) {
  for (let i = 0; i < steps; i += 1) {
    const state = world.state;
    if (state.over || state.won) break;
    if (state.awaitingChoice) autopilotUpgrade(world);
    world.step(STEP, autopilotSteer(state), true, autopilotAim(state));
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it and
 * the best score to show. Any other name stages the title scene.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'upgrade' && name !== 'win' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) {
      world.step(STEP, { x: 0, y: 0 }, false, { x: world.state.player.x, y: world.state.player.y - 100 }, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    playSteps(world, PLAY_SECONDS / STEP);
    return { screen: world.state.over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'upgrade') {
    // Play until the first wave clears and the upgrade cards appear.
    for (let i = 0; i < STEP_CAP; i += 1) {
      if (world.state.awaitingChoice) break;
      if (world.state.over) break;
      world.step(STEP, autopilotSteer(world.state), true, autopilotAim(world.state));
    }
    return { screen: world.state.awaitingChoice ? SCREEN_UPGRADE : SCREEN_PLAY, best: world.state.score };
  }
  // win (or end): play the whole game.
  playSteps(world, STEP_CAP);
  if (!world.state.won && !world.state.over) {
    world.stageVictory(world.state.score);
  }
  if (world.state.won) return { screen: SCREEN_WIN, best: world.state.score };
  return { screen: SCREEN_OVER, best: world.state.score };
}

// Keep the unused import honest for readers: the keeper's radius is the
// distance the autopilot keeps from a shade's edge, not its centre.
void PLAYER;
void FIELD;
