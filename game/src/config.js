// Emberfall — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to
// the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

/** The last lantern, at the centre of the field. */
export const LANTERN = { x: 640, y: 360, radius: 46, maxLight: 100 };

export const PLAYER = {
  radius: 16,
  speed: 360,
  maxHearts: 5,
  startHearts: 4,
  invulnerable: 1.2,
  fireInterval: 0.16,
  bulletSpeed: 740,
  bulletDamage: 1,
  bulletRadius: 6,
};

export const WAVES = { total: 10, betweenSeconds: 0 };

/** Enemy kinds. Wisps hunt the lantern; motes and splitters hunt the keeper;
 *  spitters keep their distance and shoot dark orbs; the Herald is wave 10. */
export const ENEMY = {
  mote:     { hp: 2,  speed: 86,  radius: 14, score: 10,  lanternDamage: 5,  touch: 1 },
  wisp:     { hp: 1,  speed: 130, radius: 10, score: 15,  lanternDamage: 4,  touch: 1 },
  splitter: { hp: 4,  speed: 62,  radius: 18, score: 20,  lanternDamage: 6, touch: 1 },
  spitter:  { hp: 3,  speed: 56,  radius: 15, score: 25,  lanternDamage: 0,  touch: 1 },
  herald:   { hp: 70, speed: 46,  radius: 42, score: 500, lanternDamage: 25, touch: 1 },
};

export const ORB = { speed: 210, radius: 8, lanternDamage: 6 };

/** How a wave is built: count grows with the wave, the mix opens up.
 *  Waves are dense on purpose: the field should always feel full of
 *  shades closing in, never an empty dark room. */
export function waveComposition(wave) {
  const count = 7 + wave * 3;
  const list = [];
  for (let i = 0; i < count; i += 1) {
    let kind = 'mote';
    const roll = (i * 37 + wave * 11) % 100;
    if (wave >= 10 && i === 0) kind = 'herald';
    else if (wave >= 3 && roll < 18) kind = 'splitter';
    else if (wave >= 2 && roll < 38) kind = 'spitter';
    else if (wave >= 2 && roll < 62) kind = 'wisp';
    list.push(kind);
  }
  return list;
}

/** Seconds between spawns inside a wave; waves get denser. */
export function spawnInterval(wave) {
  return Math.max(0.3, 0.9 - wave * 0.06);
}

/** The seven upgrades offered between waves (three are drawn each time). */
export const UPGRADES = [
  { id: 'rapid',   name: 'Rapid Embers',   text: 'Shoot 25% faster',            apply: (s) => { s.stats.fireInterval *= 0.8; } },
  { id: 'heavy',   name: 'Heavy Embers',   text: '+1 ember damage',             apply: (s) => { s.stats.bulletDamage += 1; } },
  { id: 'twin',    name: 'Twin Shot',      text: '+1 ember per shot',           apply: (s) => { s.stats.shots += 1; } },
  { id: 'swift',   name: 'Swift Boots',    text: 'Move 15% faster',             apply: (s) => { s.stats.speed *= 1.15; } },
  { id: 'mend',    name: 'Lantern Mend',   text: 'Restore 30 lantern light',    apply: (s) => { s.lantern = Math.min(LANTERN.maxLight, s.lantern + 30); } },
  { id: 'pierce',  name: 'Piercing Ember', text: 'Embers pierce +1 enemy',      apply: (s) => { s.stats.pierce += 1; } },
  { id: 'heart',   name: 'Warm Heart',     text: '+1 heart (max 5)',            apply: (s) => { s.hearts = Math.min(PLAYER.maxHearts, s.hearts + 1); } },
];

export const PALETTE = {
  backdrop: '#0d0a1e',
  skyTop: '#171233',
  skyBottom: '#0d0a1e',
  lanternGlow: '#ffb347',
  lanternCore: '#ffe9a8',
  player: '#7ee7ff',
  playerDark: '#2b7ea6',
  ember: '#ff9a3c',
  emberCore: '#ffd23c',
  mote: '#c86bff',
  wisp: '#ff5d8f',
  splitter: '#9dff57',
  spitter: '#ff7a59',
  herald: '#e5383b',
  orb: '#5b2d8e',
  panel: '#1d1836',
  panelEdge: '#3d2f6b',
  text: '#f4efe4',
  muted: '#a99fc7',
  gold: '#ffd23c',
  danger: '#ff5d5d',
  good: '#7ee787',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'emberfall.best';
