// Drawing only: the world's state and the current screen in, pixels out.
// The 1280x720 playfield is scaled to fit the window and centred, the margin
// filled with the backdrop colour. Canvas shapes and glow only — every pixel
// is drawn by this file, so the screenshots are the game's own art.
import { FIELD, FONT, LANTERN, PALETTE, PLAYER, WAVES } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const PANEL = { width: 780, top: 150, line: 32, bottom: 76 };
const CARD = { width: 340, height: 190, gap: 28 };

function starfield(random, count) {
  const stars = [];
  for (let i = 0; i < count; i += 1) {
    stars.push({ x: random() * FIELD.width, y: random() * FIELD.height, r: 0.6 + random() * 1.6, tw: random() * Math.PI * 2 });
  }
  return stars;
}

export function createRenderer(canvas, random) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const stars = starfield(random, 110);
  const fonts = new Map();
  let time = 0;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  /** Map a client point on the canvas back to playfield coordinates. */
  function toField(clientX, clientY, rectWidth, rectHeight) {
    const scaleX = canvas.width / rectWidth;
    const scaleY = canvas.height / rectHeight;
    const px = clientX * scaleX;
    const py = clientY * scaleY;
    return { x: (px - view.x) / view.scale, y: (py - view.y) / view.scale };
  }

  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `700 ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align ?? 'left';
    context.textBaseline = baseline ?? 'alphabetic';
    context.fillText(value, x, y);
  }

  function textPlain(value, x, y, size, color, align, baseline) {
    if (!fonts.has('p' + size)) fonts.set('p' + size, `${size}px ${FONT}`);
    context.font = fonts.get('p' + size);
    context.fillStyle = color;
    context.textAlign = align ?? 'left';
    context.textBaseline = baseline ?? 'alphabetic';
    context.fillText(value, x, y);
  }

  function circle(x, y, r, color) {
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, r, 0, Math.PI * 2);
    context.fill();
  }

  function drawBackground(state) {
    const grad = context.createLinearGradient(0, 0, 0, FIELD.height);
    grad.addColorStop(0, PALETTE.skyTop);
    grad.addColorStop(1, PALETTE.skyBottom);
    context.fillStyle = grad;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    for (const s of stars) {
      const alpha = 0.35 + 0.3 * Math.sin(time * 1.5 + s.tw);
      context.globalAlpha = alpha;
      circle(s.x, s.y, s.r, '#cfd6ff');
    }
    context.globalAlpha = 1;
    // Faint ground ring around the lantern.
    context.strokeStyle = 'rgba(255,179,71,0.18)';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(LANTERN.x, LANTERN.y, 150, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.arc(LANTERN.x, LANTERN.y, 230, 0, Math.PI * 2);
    context.stroke();
  }

  function drawLantern(state) {
    const pulse = 1 + 0.06 * Math.sin(time * 2);
    const glowR = 130 * pulse * (0.5 + state.lantern / 200);
    const glow = context.createRadialGradient(LANTERN.x, LANTERN.y, 10, LANTERN.x, LANTERN.y, glowR);
    glow.addColorStop(0, 'rgba(255,179,71,0.55)');
    glow.addColorStop(1, 'rgba(255,179,71,0)');
    context.fillStyle = glow;
    context.beginPath();
    context.arc(LANTERN.x, LANTERN.y, glowR, 0, Math.PI * 2);
    context.fill();
    // Lantern body: a little house of light.
    context.fillStyle = '#3a2c14';
    context.fillRect(LANTERN.x - 26, LANTERN.y - 30, 52, 60);
    context.fillStyle = PALETTE.lanternCore;
    context.fillRect(LANTERN.x - 18, LANTERN.y - 22, 36, 44);
    context.fillStyle = '#3a2c14';
    context.beginPath();
    context.moveTo(LANTERN.x - 30, LANTERN.y - 30);
    context.lineTo(LANTERN.x, LANTERN.y - 52);
    context.lineTo(LANTERN.x + 30, LANTERN.y - 30);
    context.closePath();
    context.fill();
    context.fillStyle = '#3a2c14';
    context.fillRect(LANTERN.x - 8, LANTERN.y + 30, 16, 10);
    textPlain('LIGHT ' + Math.max(0, Math.round(state.lantern)), LANTERN.x, LANTERN.y + 78, 15, state.lantern < 30 ? PALETTE.danger : PALETTE.gold, 'center');
  }

  function drawPlayer(state) {
    const p = state.player;
    if (p.invulnerable > 0 && Math.floor(p.invulnerable * 10) % 2 === 0) return;
    // Aim line, faint.
    context.strokeStyle = 'rgba(126,231,255,0.35)';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(p.x, p.y);
    context.lineTo(p.x + Math.cos(p.aim) * 44, p.y + Math.sin(p.aim) * 44);
    context.stroke();
    // Keeper: a hooded figure, drawn as a cloak triangle and a glowing face.
    context.fillStyle = PALETTE.playerDark;
    context.beginPath();
    context.moveTo(p.x, p.y - 20);
    context.lineTo(p.x - 15, p.y + 14);
    context.lineTo(p.x + 15, p.y + 14);
    context.closePath();
    context.fill();
    circle(p.x, p.y - 6, 10, PALETTE.player);
    circle(p.x, p.y - 6, 4, '#eafcff');
    // The keeper's own small lantern.
    circle(p.x + Math.cos(p.aim) * 20, p.y + Math.sin(p.aim) * 20, 5, PALETTE.lanternCore);
  }

  function drawEnemy(e) {
    const color = { mote: PALETTE.mote, wisp: PALETTE.wisp, splitter: PALETTE.splitter, spitter: PALETTE.spitter, herald: PALETTE.herald }[e.kind];
    if (e.flash > 0) {
      circle(e.x, e.y, e.radius + 3, '#ffffff');
      return;
    }
    if (e.kind === 'mote') {
      // Spiky shade: a circle with eight spikes.
      context.fillStyle = color;
      context.beginPath();
      for (let i = 0; i < 16; i += 1) {
        const a = (i / 16) * Math.PI * 2;
        const r = i % 2 === 0 ? e.radius + 6 : e.radius - 2;
        const x = e.x + Math.cos(a) * r;
        const y = e.y + Math.sin(a) * r;
        if (i === 0) context.moveTo(x, y); else context.lineTo(x, y);
      }
      context.closePath();
      context.fill();
      circle(e.x, e.y, 4, '#1a0b2e');
    } else if (e.kind === 'wisp') {
      context.fillStyle = color;
      context.beginPath();
      context.moveTo(e.x, e.y - e.radius - 6);
      context.quadraticCurveTo(e.x + e.radius, e.y, e.x, e.y + e.radius);
      context.quadraticCurveTo(e.x - e.radius, e.y, e.x, e.y - e.radius - 6);
      context.fill();
      circle(e.x - 3, e.y - 2, 2, '#fff');
      circle(e.x + 3, e.y - 2, 2, '#fff');
    } else if (e.kind === 'splitter') {
      context.fillStyle = color;
      context.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 + time * 0.5;
        const x = e.x + Math.cos(a) * e.radius;
        const y = e.y + Math.sin(a) * e.radius;
        if (i === 0) context.moveTo(x, y); else context.lineTo(x, y);
      }
      context.closePath();
      context.fill();
      circle(e.x, e.y, e.radius * 0.45, '#1a2e0b');
    } else if (e.kind === 'spitter') {
      context.fillStyle = color;
      context.save();
      context.translate(e.x, e.y);
      context.rotate(Math.PI / 4);
      context.fillRect(-e.radius * 0.7, -e.radius * 0.7, e.radius * 1.4, e.radius * 1.4);
      context.restore();
      circle(e.x, e.y, 5, '#2e0b1a');
    } else {
      // The Gloom Herald: a big crowned shade.
      context.fillStyle = color;
      context.beginPath();
      context.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#2e0b0b';
      context.beginPath();
      context.moveTo(e.x - 30, e.y - e.radius + 6);
      context.lineTo(e.x - 15, e.y - e.radius - 18);
      context.lineTo(e.x, e.y - e.radius + 2);
      context.lineTo(e.x + 15, e.y - e.radius - 18);
      context.lineTo(e.x + 30, e.y - e.radius + 6);
      context.closePath();
      context.fill();
      circle(e.x - 14, e.y - 4, 6, '#ffd23c');
      circle(e.x + 14, e.y - 4, 6, '#ffd23c');
    }
    // Health pips for tougher shades.
    if (e.hp > 1 && e.kind !== 'herald') {
      context.fillStyle = 'rgba(255,255,255,0.75)';
      context.fillRect(e.x - 10, e.y - e.radius - 10, 20, 3);
      context.fillStyle = color;
      context.fillRect(e.x - 10, e.y - e.radius - 10, 20 * Math.min(1, e.hp / 4), 3);
    }
  }

  function drawField(state) {
    drawBackground(state);
    drawLantern(state);
    for (const o of state.orbs) {
      if (!o.active) continue;
      circle(o.x, o.y, o.radius + 3, 'rgba(91,45,142,0.5)');
      circle(o.x, o.y, o.radius, PALETTE.orb);
      circle(o.x, o.y, 3, '#d9b3ff');
    }
    for (const b of state.bullets) {
      if (!b.active) continue;
      circle(b.x, b.y, b.radius + 3, 'rgba(255,154,60,0.45)');
      circle(b.x, b.y, b.radius, PALETTE.ember);
      circle(b.x, b.y, 2.5, PALETTE.emberCore);
    }
    for (const e of state.enemies) if (e.active) drawEnemy(e);
    drawPlayer(state);
    for (const p of state.particles) {
      if (!p.active) continue;
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      circle(p.x, p.y, p.size, p.color);
    }
    context.globalAlpha = 1;
  }

  function drawHearts(state) {
    for (let i = 0; i < PLAYER.maxHearts; i += 1) {
      const x = FIELD.width - 24 - (PLAYER.maxHearts - i) * 30;
      const y = 34;
      context.fillStyle = i < state.player.hearts ? '#ff5d8f' : 'rgba(255,255,255,0.15)';
      context.beginPath();
      context.moveTo(x, y + 8);
      context.bezierCurveTo(x - 10, y - 2, x - 5, y - 10, x, y - 4);
      context.bezierCurveTo(x + 5, y - 10, x + 10, y - 2, x, y + 8);
      context.fill();
    }
  }

  function drawHud(state, muted) {
    context.textBaseline = 'top';
    text('Score ' + state.score, 24, 18, 28, PALETTE.text, 'left', 'top');
    text('Wave ' + Math.min(state.wave, WAVES.total) + '/' + WAVES.total, FIELD.width / 2, 18, 28, PALETTE.text, 'center', 'top');
    drawHearts(state);
    // Lantern light bar, under the score.
    context.fillStyle = 'rgba(255,255,255,0.15)';
    context.fillRect(24, 56, 220, 12);
    context.fillStyle = state.lantern < 30 ? PALETTE.danger : PALETTE.gold;
    context.fillRect(24, 56, 220 * (state.lantern / LANTERN.maxLight), 12);
    textPlain('LANTERN', 24, 74, 13, PALETTE.muted, 'left', 'top');
    if (state.combo > 1) {
      text('Combo x' + Math.min(5, 1 + Math.floor(state.combo / 4)) + '  (' + state.combo + ' hits)', 24, 96, 20, PALETTE.gold, 'left', 'top');
    }
    textPlain(muted ? 'M: sound off' : 'M: mute · P: pause', FIELD.width - 24, FIELD.height - 28, 14, PALETTE.muted, 'right', 'top');
  }

  function drawPanel(title, lines, prompt, accent) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(10,7,26,0.72)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 78, 48, accent ?? PALETTE.text, 'center');
    for (let i = 0; i < lines.length; i += 1) {
      textPlain(lines[i], FIELD.width / 2, y + PANEL.top + i * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 23, PALETTE.gold, 'center');
  }

  function drawUpgrade(state) {
    context.fillStyle = 'rgba(10,7,26,0.72)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    text('Wave ' + state.wave + ' cleared!', FIELD.width / 2, 108, 44, PALETTE.gold, 'center');
    textPlain('Choose one blessing for the lantern keeper  (press 1, 2 or 3, or click a card)', FIELD.width / 2, 158, 20, PALETTE.muted, 'center');
    const total = CARD.width * 3 + CARD.gap * 2;
    const startX = (FIELD.width - total) / 2;
    const y = 210;
    state.upgradeChoices.forEach((u, i) => {
      const x = startX + i * (CARD.width + CARD.gap);
      context.fillStyle = PALETTE.panel;
      context.fillRect(x, y, CARD.width, CARD.height);
      context.strokeStyle = PALETTE.panelEdge;
      context.lineWidth = 2;
      context.strokeRect(x, y, CARD.width, CARD.height);
      text(String(i + 1), x + CARD.width / 2, y + 56, 30, PALETTE.gold, 'center');
      text(u.name, x + CARD.width / 2, y + 104, 26, PALETTE.text, 'center');
      textPlain(u.text, x + CARD.width / 2, y + 142, 19, PALETTE.muted, 'center');
    });
    textPlain('Score ' + state.score + '   ·   Lantern ' + Math.round(state.lantern) + '   ·   Hearts ' + state.player.hearts, FIELD.width / 2, y + CARD.height + 56, 20, PALETTE.text, 'center');
  }

  /** Paint one frame: the field, then the HUD or a panel for the screen. */
  function draw(state, screen, best, muted) {
    time += 1 / 60;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawField(state);
    if (screen === SCREEN_TITLE) {
      drawPanel('EMBERFALL', [
        'The last lantern is fading. Shades crawl out of the dark',
        'to snuff it out — and only you, its keeper, stand in the way.',
        'Move with WASD or arrows. Aim with the mouse.',
        'Hold click or Space to shoot embers.',
        'Wisps hunt the lantern. Motes hunt you. Survive 10 waves.',
        best > 0 ? 'Best score: ' + best : '',
      ], 'Press Space or click to begin');
      return;
    }
    drawHud(state, muted);
    if (screen === SCREEN_UPGRADE) drawUpgrade(state);
    else if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The shades wait in the dark.'], 'Press P to keep fighting');
    } else if (screen === SCREEN_OVER) {
      drawPanel('The light went out', [
        'Score ' + state.score + '    ·    Best ' + Math.max(best, state.score),
        'You reached wave ' + state.wave + ' of ' + WAVES.total + '.',
        'The lantern can be lit again.',
      ], 'Press Space or click to try again', PALETTE.danger);
    } else if (screen === SCREEN_WIN) {
      drawPanel('DAWN BREAKS', [
        'All ten waves are beaten. The lantern burns bright again.',
        'Score ' + state.score + '    ·    Best ' + Math.max(best, state.score),
        'The keeper kept the light — and the night gave up.',
      ], 'Press Space or click to play again', PALETTE.gold);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toField };
}
