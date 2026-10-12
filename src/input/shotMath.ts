import type { Point } from '../game/rules';

export interface ShotLimits {
  minDrag: number;
  maxDrag: number;
  maxVelocity: number;
  maxSwipeSpeed: number;
}

export interface ShotVector {
  velocity: Point;
  speed: number;
  power: number;
  dragDistance: number;
}

export interface AimPreview extends ShotVector {
  origin: Point;
  pointer: Point;
}

export function clampShooterX(x: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, x));
}

export function calculateShot(origin: Point, pointer: Point, durationMs: number, limits: ShotLimits): ShotVector | null {
  const dx = pointer.x - origin.x;
  const dy = pointer.y - origin.y;
  const rawDistance = Math.hypot(dx, dy);
  if (rawDistance < limits.minDrag || dy >= 0) return null;

  const dragDistance = Math.min(rawDistance, limits.maxDrag);
  const distancePower = dragDistance / limits.maxDrag;
  const swipeSpeed = rawDistance / Math.max(16, durationMs);
  const speedPower = Math.min(1, swipeSpeed / limits.maxSwipeSpeed);
  const power = Math.min(1, distancePower * .65 + speedPower * .35);
  const speed = power * limits.maxVelocity;
  return {
    velocity: { x: dx / rawDistance * speed, y: dy / rawDistance * speed },
    speed,
    power,
    dragDistance,
  };
}
