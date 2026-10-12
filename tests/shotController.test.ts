// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShotController } from '../src/input/ShotController';
import type { GameState } from '../src/game/gameState';

function pointer(type: string, x: number, y: number, id = 1, pointerType = 'mouse', timeStamp = 0) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { clientX: x, clientY: y, pointerId: id, pointerType, button: 0 });
  Object.defineProperty(event, 'timeStamp', { value: timeStamp });
  return event;
}

function setup(initialState: GameState = 'positioning') {
  const canvas = document.createElement('canvas');
  canvas.width = 420;
  canvas.height = 780;
  document.body.append(canvas);
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 420, bottom: 780, width: 420, height: 780, toJSON() {} });
  const setCapture = vi.fn();
  const releaseCapture = vi.fn();
  Object.assign(canvas, { setPointerCapture: setCapture, releasePointerCapture: releaseCapture, hasPointerCapture: () => true });
  let state = initialState;
  let shooter = { x: 210, y: 664 };
  const onPosition = vi.fn((x: number) => { shooter = { ...shooter, x }; });
  const onPositionConfirmed = vi.fn(() => { state = 'aiming'; });
  const onAim = vi.fn();
  const onShoot = vi.fn();
  const onCancel = vi.fn();
  const controller = new ShotController(canvas, {
    getState: () => state,
    getShooter: () => shooter,
    onPosition,
    onPositionConfirmed,
    onAim,
    onShoot,
    onCancel,
  });
  return { canvas, controller, setCapture, releaseCapture, onPosition, onPositionConfirmed, onAim, onShoot, onCancel, setState: (next: GameState) => { state = next; } };
}

afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

describe('ShotController', () => {
  it('launches from positioning with one forward swipe for mouse or touch', () => {
    for (const pointerType of ['mouse', 'touch']) {
      const s = setup();
      s.canvas.dispatchEvent(pointer('pointerdown', 210, 664, 1, pointerType, 100));
      s.canvas.dispatchEvent(pointer('pointermove', 230, 614, 1, pointerType, 150));
      s.canvas.dispatchEvent(pointer('pointerup', 240, 574, 1, pointerType, 190));
      expect(s.onPosition).not.toHaveBeenCalled();
      expect(s.onPositionConfirmed).toHaveBeenCalledOnce();
      expect(s.onShoot).toHaveBeenCalledOnce();
      expect(s.onShoot.mock.calls[0]?.[0].velocity).toMatchObject({ x: expect.any(Number), y: expect.any(Number) });
      expect(s.onShoot.mock.calls[0]?.[0].velocity.x).toBeGreaterThan(0);
      expect(s.onShoot.mock.calls[0]?.[0].velocity.y).toBeLessThan(0);
      expect(s.setCapture).toHaveBeenCalledWith(1);
      expect(s.releaseCapture).toHaveBeenCalledWith(1);
      s.controller.destroy();
    }
  });

  it('rejects rapid taps and emits one valid outside-canvas shot', () => {
    const s = setup('aiming');
    s.canvas.dispatchEvent(pointer('pointerdown', 210, 664, 1, 'mouse', 100));
    s.canvas.dispatchEvent(pointer('pointerup', 210, 664, 1, 'mouse', 120));
    expect(s.onShoot).not.toHaveBeenCalled();
    s.canvas.dispatchEvent(pointer('pointerdown', 210, 664, 2, 'mouse', 200));
    s.canvas.dispatchEvent(pointer('pointermove', 210, 560, 2, 'mouse', 260));
    s.canvas.dispatchEvent(pointer('pointerup', 210, 520, 2, 'mouse', 280));
    expect(s.onShoot).toHaveBeenCalledOnce();
  });

  it('owns one pointer, cancels exactly once, and ignores locked states', () => {
    const s = setup('aiming');
    s.canvas.dispatchEvent(pointer('pointerdown', 210, 664, 1));
    s.canvas.dispatchEvent(pointer('pointerdown', 210, 664, 2, 'touch'));
    s.canvas.dispatchEvent(pointer('pointercancel', 220, 690, 2));
    expect(s.onCancel).not.toHaveBeenCalled();
    s.canvas.dispatchEvent(pointer('pointercancel', 220, 690, 1));
    s.canvas.dispatchEvent(pointer('pointercancel', 220, 690, 1));
    expect(s.onCancel).toHaveBeenCalledOnce();
    s.setState('settling');
    s.canvas.dispatchEvent(pointer('pointerdown', 210, 664, 3));
    expect(s.setCapture).toHaveBeenCalledTimes(1);
  });

  it('releases capture and cancels when destroyed mid-gesture', () => {
    const s = setup('aiming');
    s.canvas.dispatchEvent(pointer('pointerdown', 210, 664, 7));
    s.controller.destroy();
    expect(s.releaseCapture).toHaveBeenCalledWith(7);
    expect(s.onCancel).toHaveBeenCalledOnce();
  });
});
