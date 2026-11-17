// Sunhaven input: keyboard state plus mouse aim, with edge-triggered actions.
// One job: turn raw DOM events into "held keys" and "just pressed" actions.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_SHOOT = 8;
export const ACTION_MUTE = 16;
export const ACTION_INTERACT = 32;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let mouseDown = false;
  let clicked = false;

  function keyName(e) {
    return e.code;
  }

  function onKeyDown(e) {
    if (e.repeat) return;
    keys.add(keyName(e));
    if (e.code === 'Space' || e.code === 'Enter') {
      actions |= ACTION_CONFIRM;
      e.preventDefault();
    }
    if (e.code === 'KeyP' || e.code === 'Escape') actions |= ACTION_PAUSE;
    if (e.code === 'KeyE') actions |= ACTION_ENTER_CAR | ACTION_INTERACT;
    if (e.code === 'KeyM') actions |= ACTION_MUTE;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  }

  function onKeyUp(e) {
    keys.delete(keyName(e));
  }

  function onMouseMove(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
  }

  function onMouseDown(e) {
    if (e.button === 0) {
      mouseDown = true;
      clicked = true;
      actions |= ACTION_SHOOT;
    }
  }

  function onMouseUp(e) {
    if (e.button === 0) mouseDown = false;
  }

  function onBlur() {
    keys.clear();
    mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    // -1..1 steering / throttle style axes, from WASD or arrows.
    axes() {
      let x = 0;
      let y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      return { x, y };
    },
    get run() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    get handbrake() { return keys.has('Space'); },
    get mouse() { return { x: mouseX, y: mouseY, down: mouseDown }; },
    get wasClicked() { return clicked; },
    takeActions() {
      const a = actions;
      actions = 0;
      clicked = false;
      return a;
    },
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
    },
  };
}
