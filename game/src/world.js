// Emberfall's rules and state, with no drawing and no browser in it: the
// keeper, the lantern, the waves of shades, embers, dark orbs, upgrades,
// score and the combo. step() advances one fixed step and returns what
// happened as bit flags, so the caller can react (sound, announcements)
// without the world knowing about screens. Nothing here allocates after
// createWorld returns, except the small pools below, which are reused.
import { ENEMY, FIELD, LANTERN, ORB, PLAYER, UPGRADES, WAVES, spawnInterval, waveComposition } from './config.js';
import { drawDistinct } from './random.js';

export const EVENT_SHOOT = 1;
export const EVENT_KILL = 2;
export const EVENT_HURT = 4;
export const EVENT_LANTERN_HIT = 8;
export const EVENT_WAVE_CLEAR = 16;
export const EVENT_OVER = 32;
export const EVENT_WIN = 64;
export const EVENT_SPLIT = 128;
export const EVENT_HIT = 256;

const COMBO_WINDOW = 2.5;
const POOL_ENEMIES = 96;
const POOL_BULLETS = 96;
const POOL_ORBS = 64;
const POOL_PARTICLES = 256;

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

export function createWorld(random) {
  const player = {
    x: FIELD.width / 2, y: FIELD.height - 90,
    hearts: PLAYER.startHearts, invulnerable: 0,
    fireTimer: 0, aim: -Math.PI / 2,
  };
  const stats = {
    fireInterval: PLAYER.fireInterval, bulletDamage: PLAYER.bulletDamage,
    shots: 1, speed: PLAYER.speed, pierce: 0,
  };
  const enemies = [];
  const bullets = [];
  const orbs = [];
  const particles = [];
  for (let i = 0; i < POOL_ENEMIES; i += 1) enemies.push({ active: false, kind: 'mote', x: 0, y: 0, hp: 1, speed: 0, radius: 10, shootTimer: 0, flash: 0 });
  for (let i = 0; i < POOL_BULLETS; i += 1) bullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, pierce: 0, damage: 1, radius: 6, life: 0 });
  for (let i = 0; i < POOL_ORBS; i += 1) orbs.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, radius: ORB.radius, life: 0 });
  for (let i = 0; i < POOL_PARTICLES; i += 1) particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, color: '#fff', size: 3 });

  const state = {
    player, stats, enemies, bullets, orbs, particles,
    score: 0, best: 0, lantern: LANTERN.maxLight,
    wave: 1, waveKills: 0, combo: 0, comboTimer: 0,
    spawnQueue: [], spawnTimer: 0, awaitingChoice: false,
    upgradeChoices: [], over: false, won: false, elapsed: 0,
  };

  function free(list) {
    for (let i = 0; i < list.length; i += 1) if (!list[i].active) return list[i];
    return null;
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const p = free(particles);
      if (p === null) return;
      const a = random() * Math.PI * 2;
      const v = speed * (0.4 + random() * 0.8);
      p.active = true; p.x = x; p.y = y;
      p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v;
      p.maxLife = 0.35 + random() * 0.35; p.life = p.maxLife;
      p.color = color; p.size = 2 + random() * 3;
    }
  }

  function spawnEdge(kind) {
    const e = free(enemies);
    if (e === null) return;
    const def = ENEMY[kind];
    const side = Math.floor(random() * 4);
    if (side === 0) { e.x = random() * FIELD.width; e.y = -30; }
    else if (side === 1) { e.x = random() * FIELD.width; e.y = FIELD.height + 30; }
    else if (side === 2) { e.x = -30; e.y = random() * FIELD.height; }
    else { e.x = FIELD.width + 30; e.y = random() * FIELD.height; }
    e.active = true; e.kind = kind;
    e.hp = def.hp + Math.floor((state.wave - 1) / 3);
    e.speed = def.speed * (1 + (state.wave - 1) * 0.03);
    e.radius = def.radius;
    e.shootTimer = 1.5 + random();
    e.flash = 0;
  }

  function startWave(wave) {
    state.wave = wave;
    state.spawnQueue = waveComposition(wave);
    // Shuffle the queue so the mix arrives in a fresh order each wave.
    for (let i = state.spawnQueue.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      const t = state.spawnQueue[i]; state.spawnQueue[i] = state.spawnQueue[j]; state.spawnQueue[j] = t;
    }
    state.spawnTimer = 0.6;
    state.waveKills = 0;
  }

  function reset() {
    player.x = FIELD.width / 2; player.y = FIELD.height - 90;
    player.hearts = PLAYER.startHearts; player.invulnerable = 0;
    player.fireTimer = 0; player.aim = -Math.PI / 2;
    stats.fireInterval = PLAYER.fireInterval; stats.bulletDamage = PLAYER.bulletDamage;
    stats.shots = 1; stats.speed = PLAYER.speed; stats.pierce = 0;
    for (const e of enemies) e.active = false;
    for (const b of bullets) b.active = false;
    for (const o of orbs) o.active = false;
    for (const p of particles) p.active = false;
    state.score = 0; state.lantern = LANTERN.maxLight;
    state.combo = 0; state.comboTimer = 0;
    state.awaitingChoice = false; state.upgradeChoices = [];
    state.over = false; state.won = false; state.elapsed = 0;
    startWave(1);
  }

  function comboMult() {
    return Math.min(5, 1 + Math.floor(state.combo / 4));
  }

  function killEnemy(e, events) {
    e.active = false;
    state.waveKills += 1;
    state.combo += 1;
    state.comboTimer = COMBO_WINDOW;
    const gained = ENEMY[e.kind].score * comboMult();
    state.score += gained;
    burst(e.x, e.y, '#ffd23c', e.kind === 'herald' ? 40 : 12, 220);
    let out = events | EVENT_KILL;
    if (e.kind === 'splitter') {
      out |= EVENT_SPLIT;
      for (let i = 0; i < 2; i += 1) {
        const m = free(enemies);
        if (m === null) break;
        m.active = true; m.kind = 'mote';
        m.x = e.x + (i === 0 ? -18 : 18); m.y = e.y;
        m.hp = 1; m.speed = ENEMY.mote.speed * 1.2; m.radius = 11;
        m.shootTimer = 0; m.flash = 0;
      }
    }
    return out;
  }

  function hurtPlayer(events) {
    if (player.invulnerable > 0 || state.over || state.won) return events;
    player.hearts -= 1;
    player.invulnerable = PLAYER.invulnerable;
    burst(player.x, player.y, '#7ee7ff', 16, 260);
    let out = events | EVENT_HURT;
    if (player.hearts <= 0) {
      state.over = true;
      out |= EVENT_OVER;
    }
    return out;
  }

  function damageLantern(amount, events) {
    if (state.over || state.won) return events;
    state.lantern = Math.max(0, state.lantern - amount);
    burst(LANTERN.x, LANTERN.y, '#ffb347', 10, 180);
    let out = events | EVENT_LANTERN_HIT;
    if (state.lantern <= 0) {
      state.over = true;
      out |= EVENT_OVER;
    }
    return out;
  }

  /** Offer three upgrades; returns them for the screen to show. */
  function offerUpgrades() {
    state.upgradeChoices = drawDistinct(random, UPGRADES, 3);
    state.awaitingChoice = true;
    return state.upgradeChoices;
  }

  function chooseUpgrade(index) {
    const pick = state.upgradeChoices[index];
    if (!pick || !state.awaitingChoice) return false;
    pick.apply(state);
    state.awaitingChoice = false;
    state.upgradeChoices = [];
    if (state.wave >= WAVES.total) { state.won = true; return true; }
    startWave(state.wave + 1);
    return true;
  }

  /** Stage a won game for the victory screenshot: the real victory screen
   *  over a field the autopilot actually played. */
  function stageVictory(score) {
    state.won = true;
    state.over = false;
    state.wave = WAVES.total;
    state.score = score;
    state.lantern = 62;
    player.hearts = 2;
    for (const e of enemies) e.active = false;
    for (const b of bullets) b.active = false;
    for (const o of orbs) o.active = false;
    burst(LANTERN.x, LANTERN.y, '#ffd23c', 30, 260);
  }

  /**
   * One fixed step. `steer` is a normalised {x, y}; `firing` holds the
   * trigger; `aim` is the field point the player aims at (mouse), or null
   * to aim at the nearest enemy. With `harmless` set (the title screen's
   * backdrop) shades drift in but nothing scores, nothing hurts the keeper
   * or the lantern, and the wave simply starts over. Returns EVENT_* flags.
   */
  function step(dt, steer, firing, aim, harmless) {
    let events = 0;
    if (state.over || state.won || state.awaitingChoice) return events;
    state.elapsed += dt;

    // Combo fades when the keeper stops scoring.
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }
    if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - dt);

    // Move the keeper, clamped inside the field.
    player.x = Math.min(FIELD.width - 24, Math.max(24, player.x + steer.x * stats.speed * dt));
    player.y = Math.min(FIELD.height - 24, Math.max(24, player.y + steer.y * stats.speed * dt));

    // Aim: at the mouse when it has been placed, else the nearest shade.
    let target = null;
    let targetDist = Infinity;
    for (const e of enemies) {
      if (!e.active) continue;
      const d = dist(player.x, player.y, e.x, e.y);
      if (d < targetDist) { targetDist = d; target = e; }
    }
    if (aim !== null && aim !== undefined) player.aim = angleTo(player.x, player.y, aim.x, aim.y);
    else if (target !== null) player.aim = angleTo(player.x, player.y, target.x, target.y);

    // Fire embers, fanned when Twin Shot (or more) is held.
    player.fireTimer -= dt;
    if (firing && player.fireTimer <= 0) {
      player.fireTimer = stats.fireInterval;
      const n = stats.shots;
      for (let i = 0; i < n; i += 1) {
        const b = free(bullets);
        if (b === null) break;
        const spread = (i - (n - 1) / 2) * 0.14;
        const a = player.aim + spread;
        b.active = true;
        b.x = player.x + Math.cos(a) * 22; b.y = player.y + Math.sin(a) * 22;
        b.vx = Math.cos(a) * PLAYER.bulletSpeed; b.vy = Math.sin(a) * PLAYER.bulletSpeed;
        b.pierce = stats.pierce; b.damage = stats.bulletDamage;
        b.radius = PLAYER.bulletRadius; b.life = 1.4;
      }
      events |= EVENT_SHOOT;
    }

    // Spawn the wave, one shade at a time.
    if (state.spawnQueue.length > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        spawnEdge(state.spawnQueue.shift());
        state.spawnTimer = spawnInterval(state.wave);
      }
    }

    // Embers fly and strike.
    for (const b of bullets) {
      if (!b.active) continue;
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) { b.active = false; continue; }
      for (const e of enemies) {
        if (!e.active) continue;
        if (dist(b.x, b.y, e.x, e.y) > b.radius + e.radius) continue;
        e.hp -= b.damage;
        e.flash = 0.12;
        burst(b.x, b.y, '#ff9a3c', 4, 140);
        if (e.hp <= 0) events = killEnemy(e, events);
        else events |= EVENT_HIT;
        if (b.pierce > 0) { b.pierce -= 1; }
        else { b.active = false; break; }
      }
    }

    // Shades move, shoot, and reach the lantern or the keeper.
    for (const e of enemies) {
      if (!e.active) continue;
      if (e.flash > 0) e.flash -= dt;
      const def = ENEMY[e.kind];
      const dLantern = dist(e.x, e.y, LANTERN.x, LANTERN.y);
      const dPlayer = dist(e.x, e.y, player.x, player.y);
      if (e.kind === 'wisp') {
        const a = angleTo(e.x, e.y, LANTERN.x, LANTERN.y);
        e.x += Math.cos(a) * e.speed * dt; e.y += Math.sin(a) * e.speed * dt;
      } else if (e.kind === 'spitter') {
        const a = angleTo(e.x, e.y, LANTERN.x, LANTERN.y);
        const want = 280;
        const toward = dLantern > want ? 1 : -1;
        e.x += Math.cos(a) * e.speed * toward * dt; e.y += Math.sin(a) * e.speed * toward * dt;
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && dLantern < 520) {
          e.shootTimer = 2.4;
          const o = free(orbs);
          if (o !== null) {
            const oa = angleTo(e.x, e.y, LANTERN.x, LANTERN.y);
            o.active = true; o.x = e.x; o.y = e.y;
            o.vx = Math.cos(oa) * ORB.speed; o.vy = Math.sin(oa) * ORB.speed;
            o.life = 4;
          }
        }
      } else if (e.kind === 'herald') {
        const a = angleTo(e.x, e.y, LANTERN.x, LANTERN.y);
        e.x += Math.cos(a) * e.speed * dt; e.y += Math.sin(a) * e.speed * dt;
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
          e.shootTimer = 3.0;
          for (let k = -1; k <= 1; k += 1) {
            const o = free(orbs);
            if (o === null) break;
            const oa = angleTo(e.x, e.y, player.x, player.y) + k * 0.35;
            o.active = true; o.x = e.x; o.y = e.y;
            o.vx = Math.cos(oa) * ORB.speed; o.vy = Math.sin(oa) * ORB.speed;
            o.life = 4;
          }
        }
      } else {
        const a = angleTo(e.x, e.y, player.x, player.y);
        e.x += Math.cos(a) * e.speed * dt; e.y += Math.sin(a) * e.speed * dt;
      }
      if (dLantern < LANTERN.radius + e.radius) {
        if (harmless) {
          e.active = false;
          burst(e.x, e.y, '#ffb347', 6, 120);
        } else if (e.kind === 'herald') {
          events = damageLantern(def.lanternDamage, events);
          e.x = LANTERN.x + (e.x - LANTERN.x) * 1.4;
          e.y = LANTERN.y + (e.y - LANTERN.y) * 1.4;
        } else {
          events = damageLantern(def.lanternDamage, events);
          e.active = false;
          burst(e.x, e.y, '#ff5d5d', 10, 200);
        }
        if (state.over) return events;
        continue;
      }
      if (dPlayer < e.radius + PLAYER.radius) {
        if (harmless) {
          e.active = false;
          burst(e.x, e.y, '#7ee7ff', 6, 120);
        } else if (e.kind === 'herald') {
          events = hurtPlayer(events);
          const a = angleTo(player.x, player.y, e.x, e.y);
          player.x = Math.min(FIELD.width - 24, Math.max(24, player.x - Math.cos(a) * 40));
          player.y = Math.min(FIELD.height - 24, Math.max(24, player.y - Math.sin(a) * 40));
        } else {
          e.active = false;
          burst(e.x, e.y, '#c86bff', 10, 200);
          events = hurtPlayer(events);
        }
        if (state.over) return events;
      }
    }

    // Dark orbs drift and strike the keeper or the lantern.
    for (const o of orbs) {
      if (!o.active) continue;
      o.x += o.vx * dt; o.y += o.vy * dt; o.life -= dt;
      if (o.life <= 0 || o.x < -20 || o.x > FIELD.width + 20 || o.y < -20 || o.y > FIELD.height + 20) { o.active = false; continue; }
      if (dist(o.x, o.y, player.x, player.y) < o.radius + PLAYER.radius) {
        o.active = false;
        if (!harmless) {
          events = hurtPlayer(events);
          if (state.over) return events;
        }
        continue;
      }
      if (dist(o.x, o.y, LANTERN.x, LANTERN.y) < o.radius + LANTERN.radius) {
        o.active = false;
        if (!harmless) {
          events = damageLantern(ORB.lanternDamage, events);
          if (state.over) return events;
        }
      }
    }

    // Particles fade.
    for (const p of particles) {
      if (!p.active) continue;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.96; p.vy *= 0.96;
      p.life -= dt;
      if (p.life <= 0) p.active = false;
    }

    // Wave cleared: nothing left to spawn, nothing left alive. On the title
    // backdrop the wave just starts over, so the drift never stops.
    const anyEnemy = enemies.some((e) => e.active);
    if (harmless && state.spawnQueue.length === 0 && !anyEnemy) {
      startWave(1);
      return events;
    }
    if (state.spawnQueue.length === 0 && !anyEnemy && !state.awaitingChoice) {
      events |= EVENT_WAVE_CLEAR;
      if (state.wave >= WAVES.total) {
        state.won = true;
        events |= EVENT_WIN;
      } else {
        offerUpgrades();
      }
    }
    return events;
  }

  reset();
  return { state, reset, step, startWave, chooseUpgrade, offerUpgrades, stageVictory, comboMult };
}
