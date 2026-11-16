// A small seeded random number generator (mulberry32): the same seed gives the
// same game, which is what makes the screenshot scenes repeatable.

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick `count` distinct items from `list` using `random`, in draw order. */
export function drawDistinct(random, list, count) {
  const pool = list.slice();
  const out = [];
  while (out.length < count && pool.length > 0) {
    const index = Math.floor(random() * pool.length);
    out.push(pool.splice(index, 1)[0]);
  }
  return out;
}
