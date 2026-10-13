import { describe, expect, it } from 'vitest';
import { SHOT } from '../src/config';
import { calculateAimPreview, calculateShot, clampShooterX, smoothSwipeDirection } from '../src/input/shotMath';

const limits = SHOT;

describe('shot math', () => {
  it('clamps positioning to both baseline endpoints', () => {
    expect(clampShooterX(10, 66, 354)).toBe(66);
    expect(clampShooterX(200, 66, 354)).toBe(200);
    expect(clampShooterX(400, 66, 354)).toBe(354);
  });

  it('uses a dead zone and rejects pre-threshold, horizontal, and downward swipes', () => {
    const origin = { x: 200, y: 664 };
    expect(calculateShot(origin, origin, 120, limits)).toBeNull();
    expect(calculateShot(origin, { x: 200, y: 644 }, 120, limits)).toBeNull();
    expect(calculateAimPreview(origin, { x: 200, y: 644 }, 120, limits)).toMatchObject({ locked: false });
    expect(calculateShot(origin, { x: 200, y: 675 }, 120, limits)).toBeNull();
    expect(calculateShot(origin, { x: 188, y: 664 }, 120, limits)).toBeNull();
  });

  it('launches in the valid swipe direction', () => {
    const shot = calculateShot({ x: 200, y: 664 }, { x: 220, y: 624 }, 80, limits);
    expect(shot).not.toBeNull();
    expect(shot!.velocity.x).toBeGreaterThan(0);
    expect(shot!.velocity.y).toBeLessThan(0);
    expect(shot!.velocity.x / -shot!.velocity.y).toBeCloseTo(.5);
  });

  it('caps long fast swipes at maximum velocity', () => {
    const long = calculateShot({ x: 200, y: 664 }, { x: 200, y: 440 }, 40, limits);
    expect(long?.speed).toBeCloseTo(limits.maxVelocity);
    expect(long?.dragDistance).toBe(110);
  });

  it('uses swipe distance only with useful minimum and capped maximum speeds', () => {
    const origin = { x: 200, y: 664 };
    const shortFast = calculateShot(origin, { x: 200, y: 632 }, 35, limits)!;
    const shortSlow = calculateShot(origin, { x: 200, y: 632 }, 500, limits)!;
    const longSlow = calculateShot(origin, { x: 200, y: 574 }, 500, limits)!;
    const longFast = calculateShot(origin, { x: 200, y: 574 }, 80, limits)!;

    expect(shortFast.speed).toBeCloseTo(limits.minVelocity);
    expect(shortSlow.speed).toBeCloseTo(shortFast.speed);
    expect(longSlow.speed).toBeGreaterThan(shortFast.speed);
    expect(longFast.speed).toBeCloseTo(longSlow.speed);
    expect(longFast.speed).toBeLessThanOrEqual(limits.maxVelocity);
  });

  it('smooths direction jitter while keeping the resulting direction normalized', () => {
    const direction = smoothSwipeDirection({ x: 0, y: -1 }, { x: 0.6, y: -0.8 }, 0.35);
    expect(Math.hypot(direction.x, direction.y)).toBeCloseTo(1);
    expect(direction.x).toBeGreaterThan(0);
    expect(direction.x).toBeLessThan(0.6);
    expect(direction.y).toBeLessThan(0);
  });
});
