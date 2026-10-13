// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SHOOTER_MAX_X, SHOOTER_MIN_X, SHOOTER_RADIUS } from '../src/config';
import { ShotController } from '../src/input/ShotController';
import type { GameState } from '../src/game/gameState';

function pointer(type: string, x: number, y: number, id = 1, pointerType = 'mouse', timeStamp = 0) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { clientX: x, clientY: y, pointerId: id, pointerType, button: 0 });
  Object.defineProperty(event, 'timeStamp', { value: timeStamp });
  return event;
}

let animationFrames: Map<number, FrameRequestCallback>;
let nextFrameId: number;

beforeEach(() => {
  animationFrames = new Map();
  nextFrameId = 1;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    const id = nextFrameId++;
    animationFrames.set(id, callback);
    return id;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    animationFrames.delete(id);
  });
});

function flushAnimationFrames() {
  const callbacks = [...animationFrames.values()];
  animationFrames.clear();
  callbacks.forEach((callback) => callback(16));
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
  it('locks and automatically launches from positioning without waiting for release', () => {
    for (const pointerType of ['mouse', 'touch']) {
      const s = setup();
      s.canvas.dispatchEvent(pointer('pointerdown', 210, 664, 1, pointerType, 100));
      s.canvas.dispatchEvent(pointer('pointermove', 230, 614, 1, pointerType, 150));
      expect(s.onAim.mock.calls.at(-1)?.[0]).toMatchObject({ locked: true });
      expect(s.onShoot).not.toHaveBeenCalled();
      flushAnimationFrames();
      expect(s.onPosition).toHaveBeenCalledWith(210);
      expect(s.onPositionConfirmed).toHaveBeenCalledOnce();
      expect(s.onShoot).toHaveBeenCalledOnce();
      expect(s.onShoot.mock.calls[0]?.[0].velocity).toMatchObject({ x: expect.any(Number), y: expect.any(Number) });
      expect(s.onShoot.mock.calls[0]?.[0].velocity.x).toBeGreaterThan(0);
      expect(s.onShoot.mock.calls[0]?.[0].velocity.y).toBeLessThan(0);
      expect(s.setCapture).toHaveBeenCalledWith(1);
      expect(s.releaseCapture).toHaveBeenCalledWith(1);
      s.canvas.dispatchEvent(pointer('pointerup', 240, 574, 1, pointerType, 190));
      expect(s.onShoot).toHaveBeenCalledOnce();
      s.controller.destroy();
    }
  });

  it('positions horizontally without confirming, then launches on the next swipe', () => {
    const s = setup();
    s.canvas.dispatchEvent(pointer('pointerdown', 210, 664, 1, 'touch', 100));
    s.canvas.dispatchEvent(pointer('pointermove', 126, 666, 1, 'touch', 160));
    s.canvas.dispatchEvent(pointer('pointerup', 126, 666, 1, 'touch', 180));

    expect(s.onPosition).toHaveBeenLastCalledWith(126);
    expect(s.onPositionConfirmed).not.toHaveBeenCalled();
    expect(s.onShoot).not.toHaveBeenCalled();

    s.canvas.dispatchEvent(pointer('pointerdown', 126, 664, 2, 'touch', 220));
    s.canvas.dispatchEvent(pointer('pointermove', 148, 600, 2, 'touch', 270));
    flushAnimationFrames();

    expect(s.onPositionConfirmed).toHaveBeenCalledOnce();
    expect(s.onShoot).toHaveBeenCalledOnce();
    expect(s.onShoot.mock.calls[0]?.[0].velocity.y).toBeLessThan(0);
  });

  it('clamps horizontal positioning to the aiming pad limits', () => {
    const s = setup();
    s.canvas.dispatchEvent(pointer('pointerdown', 210, 664, 1, 'mouse', 100));
    s.canvas.dispatchEvent(pointer('pointermove', -100, 664, 1, 'mouse', 140));
    s.canvas.dispatchEvent(pointer('pointermove', 600, 664, 1, 'mouse', 170));
    s.canvas.dispatchEvent(pointer('pointerup', 600, 664, 1, 'mouse', 180));

    expect(s.onPosition.mock.calls.map(([x]) => x)).toEqual([210, SHOOTER_MIN_X, SHOOTER_MAX_X]);
    expect(s.onPositionConfirmed).not.toHaveBeenCalled();
    expect(s.onShoot).not.toHaveBeenCalled();
  });

  it('repositions on pad taps, keeps the full striker inside, and ignores outside taps', () => {
    const s = setup();
    expect(SHOOTER_MIN_X).toBe(54 + SHOOTER_RADIUS);
    expect(SHOOTER_MAX_X).toBe(366 - SHOOTER_RADIUS);

    s.canvas.dispatchEvent(pointer('pointerdown', 54, 664, 1, 'touch', 100));
    s.canvas.dispatchEvent(pointer('pointerup', 54, 664, 1, 'touch', 120));
    s.canvas.dispatchEvent(pointer('pointerdown', 366, 664, 2, 'touch', 200));
    s.canvas.dispatchEvent(pointer('pointerup', 366, 664, 2, 'touch', 220));
    s.canvas.dispatchEvent(pointer('pointerdown', 180, 620, 3, 'touch', 300));
    s.canvas.dispatchEvent(pointer('pointerup', 180, 620, 3, 'touch', 320));

    expect(s.onPosition.mock.calls.map(([x]) => x)).toEqual([SHOOTER_MIN_X, SHOOTER_MAX_X]);
    expect(s.onPositionConfirmed).not.toHaveBeenCalled();
    expect(s.onShoot).not.toHaveBeenCalled();
  });

  it('repositions and launches from a swipe that starts anywhere on the pad', () => {
    const s = setup();
    s.canvas.dispatchEvent(pointer('pointerdown', 118, 664, 1, 'touch', 100));
    expect(s.onPosition).toHaveBeenLastCalledWith(118);
    s.canvas.dispatchEvent(pointer('pointermove', 142, 606, 1, 'touch', 150));
    flushAnimationFrames();

    expect(s.onPositionConfirmed).toHaveBeenCalledOnce();
    expect(s.onShoot).toHaveBeenCalledOnce();
    expect(s.onShoot.mock.calls[0]?.[0].velocity).toMatchObject({
      x: expect.any(Number),
      y: expect.any(Number),
    });
  });

  it('ignores tiny movement, previews a short swipe, and launches only after the threshold', () => {
    const s = setup('aiming');
    s.canvas.dispatchEvent(pointer('pointerdown', 210, 664, 1, 'mouse', 100));
    s.canvas.dispatchEvent(pointer('pointermove', 213, 660, 1, 'mouse', 110));
    expect(s.onShoot).not.toHaveBeenCalled();
    s.canvas.dispatchEvent(pointer('pointermove', 214, 646, 1, 'mouse', 130));
    expect(s.onAim.mock.calls.at(-1)?.[0]).toMatchObject({ locked: false });
    s.canvas.dispatchEvent(pointer('pointerup', 214, 646, 1, 'mouse', 140));
    expect(s.onShoot).not.toHaveBeenCalled();

    s.canvas.dispatchEvent(pointer('pointerdown', 210, 664, 2, 'mouse', 200));
    s.canvas.dispatchEvent(pointer('pointermove', 214, 630, 2, 'mouse', 240));
    expect(s.onAim.mock.calls.at(-1)?.[0]).toMatchObject({ locked: true });
    flushAnimationFrames();
    expect(s.onShoot).toHaveBeenCalledOnce();
  });

  it('uses a large invisible striker hit area without skewing the swipe direction', () => {
    const s = setup('aiming');
    s.canvas.dispatchEvent(pointer('pointerdown', 270, 664, 1, 'touch', 100));
    s.canvas.dispatchEvent(pointer('pointermove', 270, 624, 1, 'touch', 150));
    flushAnimationFrames();

    expect(s.setCapture).toHaveBeenCalledWith(1);
    expect(s.onShoot).toHaveBeenCalledOnce();
    expect(s.onShoot.mock.calls[0]?.[0].velocity.x).toBeCloseTo(0);
    expect(s.onShoot.mock.calls[0]?.[0].velocity.y).toBeLessThan(0);
  });

  it('locks the smoothed direction and ignores later pointer jitter', () => {
    const s = setup('aiming');
    s.canvas.dispatchEvent(pointer('pointerdown', 210, 664, 1, 'touch', 100));
    s.canvas.dispatchEvent(pointer('pointermove', 214, 648, 1, 'touch', 120));
    s.canvas.dispatchEvent(pointer('pointermove', 220, 630, 1, 'touch', 140));
    const locked = s.onAim.mock.calls.at(-1)?.[0];
    s.canvas.dispatchEvent(pointer('pointermove', 120, 700, 1, 'touch', 150));
    flushAnimationFrames();

    expect(locked).toMatchObject({ locked: true });
    expect(s.onShoot.mock.calls[0]?.[0].velocity.x).toBeGreaterThan(0);
    expect(s.onShoot.mock.calls[0]?.[0].velocity.y).toBeLessThan(0);
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
