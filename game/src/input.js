// Keyboard and pointer input. Held keys give a steering direction; one-shot
// presses (start, restart, pause, mute, upgrade picks) are queued as bit flags
// and taken once by the loop, so a press between two frames is never lost and
// never counted twice. The mouse aims: its position is kept in playfield
// coordinates, scaled from the canvas by the renderer.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_PICK_1 = 8;
export const ACTION_PICK_2 = 16;
export const ACTION_PICK_3 = 32;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const FIRE_KEY = new Set(['Space']);

export function createInput(canvas, toField) {
  let up = false;
  let down = false;
  let left = false;
  let right = false;
  let firing = false;
  let mouseDown = false;
  let actions = 0;
  const mouse = { x: 640, y: 200, inside: false };

  function trackPointer(event) {
    const rect = canvas.getBoundingClientRect();
    const point = toField(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height);
    mouse.x = point.x;
    mouse.y = point.y;
    mouse.inside = true;
  }

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (event.code === 'KeyM') { if (!event.repeat) actions |= ACTION_MUTE; }
    else if (event.code === 'Digit1') { if (!event.repeat) actions |= ACTION_PICK_1; }
    else if (event.code === 'Digit2') { if (!event.repeat) actions |= ACTION_PICK_2; }
    else if (event.code === 'Digit3') { if (!event.repeat) actions |= ACTION_PICK_3; }
    else if (CONFIRM.has(event.code)) { if (!event.repeat) actions |= ACTION_CONFIRM; }
    else if (PAUSE.has(event.code)) { if (!event.repeat) actions |= ACTION_PAUSE; }
    else return;
    if (FIRE_KEY.has(event.code)) firing = true;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
    else if (FIRE_KEY.has(event.code)) firing = false;
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    up = false; down = false; left = false; right = false; firing = false; mouseDown = false;
  });
  canvas.addEventListener('pointermove', trackPointer);
  canvas.addEventListener('pointerdown', (event) => {
    trackPointer(event);
    mouseDown = true;
    actions |= ACTION_CONFIRM;
  });
  canvas.addEventListener('pointerup', () => { mouseDown = false; });
  canvas.addEventListener('pointerleave', () => { mouseDown = false; });

  return {
    mouse,
    /** Normalised steering vector from held keys. */
    steer() {
      const x = (right ? 1 : 0) - (left ? 1 : 0);
      const y = (down ? 1 : 0) - (up ? 1 : 0);
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const len = Math.hypot(x, y);
      return { x: x / len, y: y / len };
    },
    get firing() { return firing || mouseDown; },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Test-only helper: pretend the pointer is at a field point. */
    setMouse(x, y) { mouse.x = x; mouse.y = y; mouse.inside = true; },
  };
}
