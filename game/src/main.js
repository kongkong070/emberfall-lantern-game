// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between six screens: title,
// play, upgrade, paused, game over and victory.
//
// ?seed=N fixes the wave pattern. ?shot=start|play|upgrade|win (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { createWorld, EVENT_HIT, EVENT_HURT, EVENT_KILL, EVENT_LANTERN_HIT, EVENT_OVER, EVENT_SHOOT, EVENT_WAVE_CLEAR, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_PICK_1, ACTION_PICK_2, ACTION_PICK_3, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best then lasts one visit.
  }
}

function runShot(name) {
  const renderer = createRenderer(canvas, createRandom(seed + 101));
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const renderer = createRenderer(canvas, createRandom(seed + 101));
  const input = createInput(canvas, (x, y, w, h) => renderer.toField(x, y, w, h));
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let muted = false;

  // Screen readers (and anyone watching the page's text) hear the screen
  // changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Defend the lantern through 10 waves.');
  }

  function endGame(won) {
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    announce(won
      ? `Dawn breaks. You won with score ${world.state.score}. Best ${best}.`
      : `The light went out. Score ${world.state.score}. Best ${best}.`);
  }

  function playEvents(events) {
    if (events & EVENT_SHOOT) audio.shoot();
    if (events & EVENT_HIT) audio.hit();
    if (events & EVENT_KILL) audio.kill();
    if (events & EVENT_HURT) { audio.hurt(); announce(`Hit. ${world.state.player.hearts} hearts left.`); }
    if (events & EVENT_LANTERN_HIT) { audio.lanternHit(); announce(`The lantern is hit. Light ${Math.round(world.state.lantern)}.`); }
    if (events & EVENT_WAVE_CLEAR) {
      audio.waveClear();
      if (world.state.awaitingChoice) {
        screen = SCREEN_UPGRADE;
        announce(`Wave ${world.state.wave} cleared. Choose a blessing.`);
      }
    }
    if (events & EVENT_WIN) { audio.win(); endGame(true); }
    else if (events & EVENT_OVER) { audio.lose(); endGame(false); }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM) {
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) startGame();
      else if (screen === SCREEN_PAUSED) { screen = SCREEN_PLAY; announce('Playing.'); }
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; announce('Paused.'); }
      else if (screen === SCREEN_PAUSED) { screen = SCREEN_PLAY; announce('Playing.'); }
    }
    if (screen === SCREEN_UPGRADE) {
      if (actions & ACTION_PICK_1) pickUpgrade(0);
      else if (actions & ACTION_PICK_2) pickUpgrade(1);
      else if (actions & ACTION_PICK_3) pickUpgrade(2);
    }
  }

  function pickUpgrade(index) {
    const pick = world.state.upgradeChoices[index];
    if (!pick) return;
    audio.upgrade();
    world.chooseUpgrade(index);
    if (world.state.won) { audio.win(); endGame(true); return; }
    screen = SCREEN_PLAY;
    announce(`Chose ${pick.name}. Wave ${world.state.wave} begins.`);
  }

  // Clicking a card picks it: the upgrade screen's cards are laid out in the
  // same geometry the renderer draws, so a click maps back to a card.
  canvas.addEventListener('pointerdown', () => {
    if (screen !== SCREEN_UPGRADE) return;
    const m = input.mouse;
    const cardWidth = 340;
    const cardHeight = 190;
    const gap = 28;
    const total = cardWidth * 3 + gap * 2;
    const startX = (1280 - total) / 2;
    const y = 210;
    if (m.y < y || m.y > y + cardHeight) return;
    for (let i = 0; i < 3; i += 1) {
      const x = startX + i * (cardWidth + gap);
      if (m.x >= x && m.x <= x + cardWidth) { pickUpgrade(i); return; }
    }
  });

  function step() {
    if (screen === SCREEN_TITLE) {
      // The title's backdrop: shades drift in, but nothing can hurt anyone.
      world.step(STEP, { x: 0, y: 0 }, false, { x: world.state.player.x, y: world.state.player.y - 100 }, true);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const aim = input.mouse.inside ? { x: input.mouse.x, y: input.mouse.y } : null;
    const events = world.step(STEP, input.steer(), input.firing, aim);
    playEvents(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, muted);
  }

  // Leaving the tab pauses a running game rather than letting shades feed unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Emberfall. Press Space or click to start. Defend the last lantern.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
