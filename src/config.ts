import type { Bounds } from './game/rules';

export const VIRTUAL_WIDTH = 420;
export const VIRTUAL_HEIGHT = 780;
export const TARGET_RADIUS = 24;
export const SHOOTER_RADIUS = 24;
export const SHOOTER_BASELINE_Y = 664;
export const SHOOTER_MIN_X = 66;
export const SHOOTER_MAX_X = 354;
export const LEVEL_LAYOUT_BOUNDS: Bounds = { left: 44, right: 376, top: 116, bottom: 558 };
export const BOARD_BOUNDS: Bounds = { left: 0, right: VIRTUAL_WIDTH, top: 0, bottom: VIRTUAL_HEIGHT };
export const DEBUG_PHYSICS = false;

export const PHYSICS = {
  fixedStepMs: 1000 / 60,
  maxCatchUpSteps: 5,
  restitution: 0.78,
  collisionFriction: 0.04,
  frictionAir: 0.024,
  settleSpeed: 0.12,
  settleAngularSpeed: 0.012,
  settleFrames: 12,
  targetDensity: 0.001,
  shooterDensity: 0.00175,
} as const;

export const SHOT = {
  minDrag: 12,
  maxDrag: 110,
  maxVelocity: 28,
  maxSwipeSpeed: 1.4,
} as const;

export const COLORS = {
  background: '#FAF3E4',
  boundary: '#252525',
  shooter: '#1F1F1F',
  shooterPad: '#E8D5C0',
  text: '#F7F5F0',
  teal: '#1D6456',
  blue: '#2674B8',
  green: '#4F8A68',
  violet: '#78649A',
} as const;
