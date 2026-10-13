import type { Point } from '../game/rules';

export interface ShotLimits {
  deadZone: number;
  aimThreshold: number;
  maxDrag: number;
  minVelocity: number;
  maxVelocity: number;
  minUpwardRatio: number;
  directionSmoothing: number;
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
  locked: boolean;
}

export function clampShooterX(x: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, x));
}

function normalize(vector: Point): Point {
  const length = Math.hypot(vector.x, vector.y);
  return length > 0 ? { x: vector.x / length, y: vector.y / length } : { x: 0, y: 0 };
}

export function smoothSwipeDirection(previous: Point | null, sample: Point, smoothing: number): Point {
  const current = normalize(sample);
  if (!previous) return current;
  const amount = Math.min(1, Math.max(0, smoothing));
  return normalize({
    x: previous.x * (1 - amount) + current.x * amount,
    y: previous.y * (1 - amount) + current.y * amount,
  });
}

function calculateSwipe(
  origin: Point,
  pointer: Point,
  limits: ShotLimits,
  minimumDistance: number,
  direction?: Point,
): ShotVector | null {
  const dx = pointer.x - origin.x;
  const dy = pointer.y - origin.y;
  const rawDistance = Math.hypot(dx, dy);
  if (rawDistance < minimumDistance) return null;

  const unit = direction ? normalize(direction) : normalize({ x: dx, y: dy });
  if (unit.y >= 0 || -unit.y < limits.minUpwardRatio) return null;

  const dragDistance = Math.min(rawDistance, limits.maxDrag);
  const powerRange = Math.max(1, limits.maxDrag - limits.aimThreshold);
  const power = Math.min(1, Math.max(0, (dragDistance - limits.aimThreshold) / powerRange));
  const speed = limits.minVelocity + power * (limits.maxVelocity - limits.minVelocity);
  return {
    velocity: { x: unit.x * speed, y: unit.y * speed },
    speed,
    power,
    dragDistance,
  };
}

export function calculateAimPreview(
  origin: Point,
  pointer: Point,
  _durationMs: number,
  limits: ShotLimits,
  direction?: Point,
  locked = false,
): AimPreview | null {
  const shot = calculateSwipe(origin, pointer, limits, limits.deadZone, direction);
  return shot ? { ...shot, origin, pointer, locked } : null;
}

export function calculateShot(
  origin: Point,
  pointer: Point,
  _durationMs: number,
  limits: ShotLimits,
  direction?: Point,
): ShotVector | null {
  return calculateSwipe(origin, pointer, limits, limits.aimThreshold, direction);
}
